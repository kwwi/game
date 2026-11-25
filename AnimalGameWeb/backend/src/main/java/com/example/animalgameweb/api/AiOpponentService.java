package com.example.animalgameweb.api;

import com.example.animalgameweb.core.Camp;
import com.example.animalgameweb.core.GameEngine;
import com.example.animalgameweb.core.GameResult;
import com.example.animalgameweb.core.GameState;
import com.example.animalgameweb.core.Move;
import com.example.animalgameweb.core.PieceType;
import com.example.animalgameweb.core.Side;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiOpponentService {

    private static final Logger log = LoggerFactory.getLogger(AiOpponentService.class);
    private static final Pattern ACTION_ID = Pattern.compile("\"actionId\"\\s*:\\s*(\\d+)");

    private static final String SYSTEM_PROMPT =
            "你是动物棋（暗棋）AI，执 B 方。每回合只能从「合法动作列表」中选一个 actionId。\n" +
            "只输出一行 JSON：{\"actionId\":数字}，不要解释。\n" +
            "\n" +
            "规则摘要：\n" +
            "- 棋盘 7行×8列，坐标 (r,c) 均从 1 起。\n" +
            "- 未翻开棋可翻；已翻开棋四向相邻走一格；空格可走，可吃对方已翻开棋。\n" +
            "- 大小：鲸12>凤11>龙10>象9>狮8>虎7>豹6>豺5>狼4>狗3>猫2>鼠1；更大可吃更小。\n" +
            "- 特例：鼠可吃鲸/凤/龙/象。同级不能互吃。\n" +
            "- 「行」格 (2,3)(2,6)(6,3)(6,6) 上的棋不可被吃，仍可离开。\n" +
            "- 先翻出的阵营归属：本局 A 阵营与 B 阵营见局面说明；未定时以首翻定阵营。\n" +
            "- 目标：吃光对方全部棋子（含未翻开）。\n" +
            "\n" +
            "策略倾向：\n" +
            "- 有把握的吃子优先；避免把高价值棋送吃。\n" +
            "- 开局可适度翻牌探信息；「行」格附近谨慎。\n" +
            "- 信息不足时优先安全走子或翻低风险格。";

    private final ObjectMapper mapper = new ObjectMapper();
    private final Random rng = new Random();
    private final RestTemplate restTemplate;

    @Value("${deepseek.api-key:}")
    private String apiKey;

    @Value("${deepseek.base-url:https://api.deepseek.com}")
    private String baseUrl;

    @Value("${deepseek.model:deepseek-chat}")
    private String model;

    public AiOpponentService(@Value("${deepseek.timeout-ms:12000}") int timeoutMs) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Math.min(5000, timeoutMs));
        factory.setReadTimeout(timeoutMs);
        this.restTemplate = new RestTemplate(factory);
    }

    /** AI 走一步并 nextTurn；若无动作或已结束则不动。 */
    public void playTurn(GameEngine engine) {
        if (engine == null) return;
        if (engine.getResult() != GameResult.ONGOING) return;
        if (engine.getCurrentSide() != Side.B) return;

        List<LegalAction> actions = listLegalActions(engine);
        if (actions.isEmpty()) {
            log.warn("AI has no legal actions");
            return;
        }

        int chosen = pickActionId(engine, actions);
        if (chosen < 0 || chosen >= actions.size()) {
            chosen = heuristicPick(actions);
        }
        applyAction(engine, actions.get(chosen));
        engine.nextTurn();
    }

    private int pickActionId(GameEngine engine, List<LegalAction> actions) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.info("DeepSeek API key missing; using heuristic");
            return heuristicPick(actions);
        }
        try {
            String user = buildUserPrompt(engine, actions);
            String content = callDeepSeek(user);
            Integer id = parseActionId(content);
            if (id != null && id >= 0 && id < actions.size()) {
                return id;
            }
            log.warn("DeepSeek returned invalid actionId: {}", content);
        } catch (Exception e) {
            log.warn("DeepSeek call failed: {}", e.toString());
        }
        return heuristicPick(actions);
    }

    private String callDeepSeek(String userPrompt) throws Exception {
        String url = baseUrl.replaceAll("/$", "") + "/chat/completions";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey.trim());

        Map<String, Object> body = new HashMap<>();
        body.put("model", model);
        body.put("temperature", 0.3);
        Map<String, String> format = new HashMap<>();
        format.put("type", "json_object");
        body.put("response_format", format);

        List<Map<String, String>> messages = new ArrayList<>();
        Map<String, String> sys = new HashMap<>();
        sys.put("role", "system");
        sys.put("content", SYSTEM_PROMPT);
        messages.add(sys);
        Map<String, String> user = new HashMap<>();
        user.put("role", "user");
        user.put("content", userPrompt);
        messages.add(user);
        body.put("messages", messages);

        ResponseEntity<String> resp = restTemplate.postForEntity(
                url, new HttpEntity<>(body, headers), String.class);
        JsonNode root = mapper.readTree(resp.getBody());
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        if (content.isMissingNode() || content.isNull()) {
            throw new IllegalStateException("empty DeepSeek content");
        }
        return content.asText();
    }

    private Integer parseActionId(String content) {
        if (content == null) return null;
        Matcher m = ACTION_ID.matcher(content);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        try {
            JsonNode node = mapper.readTree(content.trim());
            if (node.has("actionId")) return node.get("actionId").asInt();
        } catch (Exception ignored) {
            // fall through
        }
        return null;
    }

    private String buildUserPrompt(GameEngine engine, List<LegalAction> actions) {
        GameState state = engine.toGameState();
        StringBuilder sb = new StringBuilder();
        sb.append("局面：\n");
        sb.append("- 当前回合：B\n");
        sb.append("- A阵营：").append(campLabel(state.aCamp))
                .append(" ；B阵营：").append(campLabel(state.bCamp)).append('\n');
        sb.append("- 结果：").append(state.result).append('\n');
        sb.append("- 棋子（未翻开不透露类型/阵营）：\n");
        for (GameState.StatePiece p : state.pieces) {
            if (p.r == null || p.c == null) continue;
            if (p.faceDown) {
                sb.append("  - id=").append(p.id).append(" FACE_DOWN @ (")
                        .append(p.r).append(',').append(p.c).append(")\n");
            } else {
                sb.append("  - id=").append(p.id).append(' ')
                        .append(typeZh(p.type)).append(' ')
                        .append(p.camp).append(" @ (")
                        .append(p.r).append(',').append(p.c).append(")\n");
            }
        }
        sb.append("- A被吃：").append(capturedSummary(state.capturedByA))
                .append(" ；B被吃：").append(capturedSummary(state.capturedByB)).append('\n');
        sb.append('\n');
        sb.append("合法动作（必须选其一）：\n");
        for (int i = 0; i < actions.size(); i++) {
            sb.append(i).append(". ").append(actions.get(i).label).append('\n');
        }
        sb.append("\n只回复：{\"actionId\":0}");
        return sb.toString();
    }

    private static String campLabel(Camp camp) {
        return camp == null ? "未定" : camp.name();
    }

    private static String typeZh(PieceType type) {
        return type == null ? "?" : type.zh;
    }

    private static String capturedSummary(List<GameState.StatePiece> list) {
        if (list == null || list.isEmpty()) return "无";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(typeZh(list.get(i).type));
        }
        return sb.toString();
    }

    List<LegalAction> listLegalActions(GameEngine engine) {
        List<LegalAction> actions = new ArrayList<>();
        GameState state = engine.toGameState();
        Map<Integer, GameState.StatePiece> byId = new HashMap<>();
        for (GameState.StatePiece p : state.pieces) {
            byId.put(p.id, p);
        }

        for (GameState.StatePiece p : state.pieces) {
            if (p.faceDown && p.r != null && p.c != null) {
                LegalAction a = new LegalAction();
                a.kind = Kind.FLIP;
                a.r = p.r;
                a.c = p.c;
                a.label = "FLIP (" + p.r + "," + p.c + ")";
                actions.add(a);
            }
        }

        for (Move m : engine.listLegalMovesForCurrentSide()) {
            LegalAction a = new LegalAction();
            a.kind = m.capture ? Kind.CAPTURE : Kind.MOVE;
            a.move = m;
            StringBuilder label = new StringBuilder();
            label.append(m.capture ? "CAPTURE" : "MOVE")
                    .append(" id=").append(m.moverId)
                    .append(" (").append(m.from.r).append(',').append(m.from.c).append(")->(")
                    .append(m.to.r).append(',').append(m.to.c).append(')');
            if (m.capture && m.capturedId != null) {
                GameState.StatePiece victim = byId.get(m.capturedId);
                label.append(" eat id=").append(m.capturedId);
                if (victim != null) label.append(' ').append(typeZh(victim.type));
            }
            a.label = label.toString();
            a.captureRank = 0;
            if (m.capture && m.capturedId != null) {
                GameState.StatePiece victim = byId.get(m.capturedId);
                if (victim != null && victim.type != null) {
                    a.captureRank = victim.type.rank;
                }
            }
            actions.add(a);
        }
        return actions;
    }

    private int heuristicPick(List<LegalAction> actions) {
        int bestIdx = -1;
        int bestRank = -1;
        for (int i = 0; i < actions.size(); i++) {
            LegalAction a = actions.get(i);
            if (a.kind == Kind.CAPTURE && a.captureRank > bestRank) {
                bestRank = a.captureRank;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0) return bestIdx;
        return rng.nextInt(actions.size());
    }

    private void applyAction(GameEngine engine, LegalAction action) {
        if (action.kind == Kind.FLIP) {
            if (engine.flipAt(action.r, action.c) == null) {
                log.warn("AI FLIP failed at ({},{})", action.r, action.c);
            }
            return;
        }
        if (action.move != null) {
            if (!engine.applyMove(action.move)) {
                log.warn("AI MOVE/CAPTURE failed: {}", action.label);
            }
        }
    }

    enum Kind { FLIP, MOVE, CAPTURE }

    static final class LegalAction {
        Kind kind;
        String label;
        int r;
        int c;
        Move move;
        int captureRank;
    }
}
