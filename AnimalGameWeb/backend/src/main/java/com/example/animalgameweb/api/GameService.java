package com.example.animalgameweb.api;

import com.example.animalgameweb.core.Camp;
import com.example.animalgameweb.core.GameEngine;
import com.example.animalgameweb.core.GameState;
import com.example.animalgameweb.core.Move;
import com.example.animalgameweb.core.Side;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.PostConstruct;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    public static final String AI_PLAYER = "__AI__";

    private final Map<String, GameSession> rooms = new ConcurrentHashMap<>();
    private final Random rng = new Random();
    private final AiOpponentService aiOpponent;

    @Value("${room.count:10}")
    private int roomCount;

    public GameService(AiOpponentService aiOpponent) {
        this.aiOpponent = aiOpponent;
    }

    @PostConstruct
    public void initRooms() {
        for (int i = 0; i < roomCount; i++) {
            createEmptyRoom();
        }
    }

    private String createEmptyRoom() {
        String id = UUID.randomUUID().toString();
        GameSession session = new GameSession();
        session.engine = null;
        session.playerA = null;
        session.playerB = null;
        session.solo = false;
        session.vsAi = false;
        rooms.put(id, session);
        return id;
    }

    public List<RoomInfo> listRooms() {
        List<RoomInfo> list = new ArrayList<>();
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            list.add(toRoomInfo(e.getKey(), e.getValue()));
        }
        return list;
    }

    private RoomInfo toRoomInfo(String roomId, GameSession s) {
        RoomInfo info = new RoomInfo();
        info.roomId = roomId;
        info.playerA = s.playerA;
        info.playerB = s.playerB;
        info.solo = s.solo;
        info.vsAi = s.vsAi;
        info.full = !s.solo && s.playerA != null && s.playerB != null;
        info.spectatorCount = s.spectators.size();
        info.hasGame = s.engine != null;
        if (s.engine != null) {
            Camp aCamp = s.engine.getCampOf(Side.A);
            Camp bCamp = s.engine.getCampOf(Side.B);
            info.roleA = aCamp == Camp.RED ? "红" : (aCamp == Camp.BLACK ? "黑" : null);
            info.roleB = bCamp == Camp.RED ? "红" : (bCamp == Camp.BLACK ? "黑" : null);
            info.result = s.engine.getResult() != null ? s.engine.getResult().name() : "ONGOING";
        }
        return info;
    }

    /** 快速加入：优先进入已有 1 人的房间，否则进入空房间 */
    public GameCreatedResponse quickJoin(JoinGameRequest req) {
        if (req == null || req.username == null || req.username.isEmpty()) return null;
        String username = req.username;

        String preferOne = null;
        String preferEmpty = null;
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            GameSession s = e.getValue();
            if (s.solo || s.vsAi) continue;
            if (s.playerA != null && s.playerB != null) continue;
            if (username.equals(s.playerA) || username.equals(s.playerB)) continue;
            // A 或 B 任一在座都算「已有一人」（含 A 离房仅剩 B 的情况）
            if (s.playerA != null || s.playerB != null) preferOne = e.getKey();
            else preferEmpty = e.getKey();
        }
        String roomId = preferOne != null ? preferOne : preferEmpty;
        if (roomId == null) {
            roomId = createEmptyRoom();
        }
        return joinRoom(roomId, req);
    }

    /** 自己与自己博弈：一人操控双方 */
    public GameCreatedResponse soloPlay(JoinGameRequest req) {
        if (req == null || req.username == null || req.username.isEmpty()) return null;
        String username = req.username;

        String roomId = null;
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            GameSession s = e.getValue();
            if (s.engine == null && s.playerA == null && s.playerB == null) {
                roomId = e.getKey();
                break;
            }
        }
        if (roomId == null) {
            roomId = createEmptyRoom();
        }

        GameSession session = rooms.get(roomId);
        GameEngine engine = new GameEngine(rng);
        int a = engine.rollDice();
        int b = engine.rollDice();
        while (a == b) {
            a = engine.rollDice();
            b = engine.rollDice();
        }
        Side first = (a > b) ? Side.A : Side.B;
        engine.setCurrentSide(first);
        engine.initRandomSetup();
        session.engine = engine;
        session.playerA = username;
        session.playerB = username;
        session.solo = true;
        session.vsAi = false;
        session.spectators.clear();

        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = engine.toGameState();
        resp.side = first;
        resp.role = "PLAYER";
        resp.solo = true;
        resp.vsAi = false;
        return resp;
    }

    /** 人机对弈：玩家固定 A，AI 为 B */
    public GameCreatedResponse vsAiPlay(JoinGameRequest req) {
        if (req == null || req.username == null || req.username.isEmpty()) return null;
        String username = req.username;

        String roomId = null;
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            GameSession s = e.getValue();
            if (s.engine == null && s.playerA == null && s.playerB == null) {
                roomId = e.getKey();
                break;
            }
        }
        if (roomId == null) {
            roomId = createEmptyRoom();
        }

        GameSession session = rooms.get(roomId);
        GameEngine engine = new GameEngine(rng);
        int a = engine.rollDice();
        int b = engine.rollDice();
        while (a == b) {
            a = engine.rollDice();
            b = engine.rollDice();
        }
        Side first = (a > b) ? Side.A : Side.B;
        engine.setCurrentSide(first);
        engine.initRandomSetup();
        session.engine = engine;
        session.playerA = username;
        session.playerB = AI_PLAYER;
        session.solo = false;
        session.vsAi = true;
        session.spectators.clear();
        // AI 先手时不在此同步落子：由前端渲染后再请求 /ai-turn

        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = engine.toGameState();
        resp.side = Side.A;
        resp.role = "PLAYER";
        resp.solo = false;
        resp.vsAi = true;
        return resp;
    }

    public GameCreatedResponse joinRoom(String roomId, JoinGameRequest req) {
        GameSession session = rooms.get(roomId);
        if (session == null || req == null || req.username == null) return null;
        String username = req.username;

        // 已在房内：重连
        if (username.equals(session.playerA) || username.equals(session.playerB)) {
            return playerResponse(roomId, session, username);
        }

        if (session.solo || session.vsAi) {
            return null;
        }

        if (session.playerA != null && session.playerB != null) {
            return null;
        }

        if (session.engine == null) {
            GameEngine engine = new GameEngine(rng);
            int a = engine.rollDice();
            int b = engine.rollDice();
            while (a == b) {
                a = engine.rollDice();
                b = engine.rollDice();
            }
            Side first = (a > b) ? Side.A : Side.B;
            engine.setCurrentSide(first);
            engine.initRandomSetup();
            session.engine = engine;
            session.playerA = username;
            session.playerB = null;
            session.solo = false;
            session.vsAi = false;

            GameCreatedResponse resp = new GameCreatedResponse();
            resp.gameId = roomId;
            resp.state = engine.toGameState();
            resp.side = Side.A;
            resp.role = "PLAYER";
            resp.solo = false;
            resp.vsAi = false;
            return resp;
        }

        // 对局已存在：优先补空着的 A 位，再补 B 位（避免 A 离房后无法续上）
        Side joinedSide;
        if (session.playerA == null) {
            session.playerA = username;
            joinedSide = Side.A;
        } else if (session.playerB == null) {
            session.playerB = username;
            joinedSide = Side.B;
        } else {
            return null;
        }
        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = session.engine.toGameState();
        resp.side = joinedSide;
        resp.role = "PLAYER";
        resp.solo = false;
        resp.vsAi = session.vsAi;
        return resp;
    }

    /** 观战：不占座位，只读对局 */
    public GameCreatedResponse spectate(String roomId, JoinGameRequest req) {
        GameSession session = rooms.get(roomId);
        if (session == null || req == null || req.username == null || req.username.isEmpty()) {
            return null;
        }
        if (session.engine == null) {
            return null;
        }
        String username = req.username;
        if (username.equals(session.playerA) || username.equals(session.playerB)) {
            return playerResponse(roomId, session, username);
        }
        session.spectators.add(username);
        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = session.engine.toGameState();
        resp.side = null;
        resp.role = "SPECTATOR";
        resp.solo = session.solo;
        resp.vsAi = session.vsAi;
        return resp;
    }

    public GameCreatedResponse leaveRoom(String roomId, JoinGameRequest req) {
        GameSession session = rooms.get(roomId);
        if (session == null || req == null || req.username == null) return null;
        String username = req.username;
        session.spectators.remove(username);

        if (session.solo && username.equals(session.playerA)) {
            resetSession(session);
        } else if (session.vsAi && username.equals(session.playerA)) {
            resetSession(session);
        } else if (username.equals(session.playerA)) {
            session.playerA = null;
            if (session.playerB == null) {
                resetSession(session);
            }
        } else if (username.equals(session.playerB)) {
            session.playerB = null;
            if (session.playerA == null) {
                resetSession(session);
            }
        }

        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = null;
        resp.side = null;
        resp.role = "LEFT";
        resp.solo = false;
        resp.vsAi = false;
        return resp;
    }

    private void resetSession(GameSession session) {
        session.engine = null;
        session.playerA = null;
        session.playerB = null;
        session.solo = false;
        session.vsAi = false;
        session.spectators.clear();
    }

    private GameCreatedResponse playerResponse(String roomId, GameSession session, String username) {
        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = session.engine != null ? session.engine.toGameState() : null;
        resp.solo = session.solo;
        resp.vsAi = session.vsAi;
        resp.role = "PLAYER";
        if (session.solo) {
            resp.side = session.engine != null ? session.engine.getCurrentSide() : Side.A;
        } else {
            resp.side = username.equals(session.playerA) ? Side.A : Side.B;
        }
        return resp;
    }

    public GameState getState(String gameId) {
        GameSession session = rooms.get(gameId);
        if (session == null || session.engine == null) return null;
        return session.engine.toGameState();
    }

    public GameState flip(String gameId, String username, FlipRequest req) {
        GameSession session = rooms.get(gameId);
        if (session == null) return null;
        if (req == null || username == null) return session.engine.toGameState();
        Side userSide = resolveSide(session, username);
        if (userSide == null || userSide != session.engine.getCurrentSide()) {
            return session.engine.toGameState();
        }
        if (session.engine.flipAt(req.r, req.c) != null) {
            session.engine.nextTurn();
        }
        return session.engine.toGameState();
    }

    public GameState move(String gameId, String username, Move move) {
        GameSession session = rooms.get(gameId);
        if (session == null || move == null || username == null) return null;
        Side userSide = resolveSide(session, username);
        if (userSide == null || userSide != session.engine.getCurrentSide()) {
            return session.engine.toGameState();
        }
        boolean ok = session.engine.applyMove(move);
        if (ok) {
            session.engine.nextTurn();
        }
        return session.engine.toGameState();
    }

    /** 人机对弈：在人类落子渲染完成并由前端延迟后，请求 AI 走一步 */
    public GameState aiTurn(String gameId, String username) {
        GameSession session = rooms.get(gameId);
        if (session == null || session.engine == null || username == null) return null;
        if (!session.vsAi) return session.engine.toGameState();
        if (!username.equals(session.playerA)) return session.engine.toGameState();
        if (session.engine.getResult() != com.example.animalgameweb.core.GameResult.ONGOING) {
            return session.engine.toGameState();
        }
        if (session.engine.getCurrentSide() != Side.B) {
            return session.engine.toGameState();
        }
        try {
            aiOpponent.playTurn(session.engine);
        } catch (Exception e) {
            // keep game playable even if AI crashes
        }
        return session.engine.toGameState();
    }

    /**
     * 普通对局：用户名对应固定一方。
     * 自弈：同一用户可操作当前回合方。
     * 人机：人类只能操作 A，不可冒充 AI。
     */
    private Side resolveSide(GameSession session, String username) {
        if (username == null) return null;
        if (session.solo) {
            if (username.equals(session.playerA) || username.equals(session.playerB)) {
                return session.engine != null ? session.engine.getCurrentSide() : Side.A;
            }
            return null;
        }
        if (session.vsAi) {
            if (username.equals(session.playerA)) return Side.A;
            return null;
        }
        if (username.equals(session.playerA)) return Side.A;
        if (username.equals(session.playerB)) return Side.B;
        return null;
    }

    private static final class GameSession {
        GameEngine engine;
        String playerA;
        String playerB;
        boolean solo;
        boolean vsAi;
        final Set<String> spectators = ConcurrentHashMap.newKeySet();
    }

    public static final class GameCreatedResponse {
        public String gameId;
        public GameState state;
        public Side side;
        public String role;
        public boolean solo;
        public boolean vsAi;
    }

    public static final class CreateGameRequest {
        public String username;
    }

    public static final class JoinGameRequest {
        public String username;
    }

    public static final class FlipRequest {
        public int r;
        public int c;
    }

    public static final class RoomInfo {
        public String roomId;
        public String playerA;
        public String playerB;
        public boolean full;
        public boolean solo;
        public boolean vsAi;
        public boolean hasGame;
        public int spectatorCount;
        public String roleA;
        public String roleB;
        public String result;
    }
}
