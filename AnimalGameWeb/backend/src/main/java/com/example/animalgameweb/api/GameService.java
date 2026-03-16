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
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private final Map<String, GameSession> rooms = new ConcurrentHashMap<>();
    private final Random rng = new Random();

    @Value("${room.count:10}")
    private int roomCount;

    @PostConstruct
    public void initRooms() {
        for (int i = 0; i < roomCount; i++) {
            String id = UUID.randomUUID().toString();
            GameSession session = new GameSession();
            session.engine = null;
            session.playerA = null;
            session.playerB = null;
            rooms.put(id, session);
        }
    }

    public List<RoomInfo> listRooms() {
        List<RoomInfo> list = new ArrayList<>();
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            GameSession s = e.getValue();
            RoomInfo info = new RoomInfo();
            info.roomId = e.getKey();
            info.playerA = s.playerA;
            info.playerB = s.playerB;
            info.full = s.playerA != null && s.playerB != null;
            if (s.engine != null) {
                Camp aCamp = s.engine.getCampOf(Side.A);
                Camp bCamp = s.engine.getCampOf(Side.B);
                info.roleA = aCamp == Camp.RED ? "红" : (aCamp == Camp.BLACK ? "黑" : null);
                info.roleB = bCamp == Camp.RED ? "红" : (bCamp == Camp.BLACK ? "黑" : null);
            }
            list.add(info);
        }
        return list;
    }

    /** 快速加入：优先进入已有 1 人的房间，否则进入空房间 */
    public GameCreatedResponse quickJoin(JoinGameRequest req) {
        if (req == null || req.username == null || req.username.isEmpty()) return null;
        String username = req.username;

        String preferOne = null;
        String preferEmpty = null;
        for (Map.Entry<String, GameSession> e : rooms.entrySet()) {
            GameSession s = e.getValue();
            if (s.playerA != null && s.playerB != null) continue;
            if (username.equals(s.playerA) || username.equals(s.playerB)) continue;
            if (s.playerA != null) preferOne = e.getKey();
            else preferEmpty = e.getKey();
        }
        String roomId = preferOne != null ? preferOne : preferEmpty;
        if (roomId == null) return null;
        return joinRoom(roomId, req);
    }

    public GameCreatedResponse joinRoom(String roomId, JoinGameRequest req) {
        GameSession session = rooms.get(roomId);
        if (session == null || req == null || req.username == null) return null;
        String username = req.username;

        if (session.playerA != null && session.playerB != null) return null;
        if (username.equals(session.playerA) || username.equals(session.playerB)) {
            GameCreatedResponse resp = new GameCreatedResponse();
            resp.gameId = roomId;
            resp.state = session.engine != null ? session.engine.toGameState() : null;
            resp.side = username.equals(session.playerA) ? Side.A : Side.B;
            return resp;
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

            GameCreatedResponse resp = new GameCreatedResponse();
            resp.gameId = roomId;
            resp.state = engine.toGameState();
            resp.side = Side.A;
            return resp;
        }

        if (session.playerB != null) return null;
        session.playerB = username;
        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = roomId;
        resp.state = session.engine.toGameState();
        resp.side = Side.B;
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

    private Side resolveSide(GameSession session, String username) {
        if (username == null) return null;
        if (username.equals(session.playerA)) return Side.A;
        if (username.equals(session.playerB)) return Side.B;
        return null;
    }

    private static final class GameSession {
        GameEngine engine;
        String playerA;
        String playerB;
    }

    public static final class GameCreatedResponse {
        public String gameId;
        public GameState state;
        public Side side;
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
        public String roleA;
        public String roleB;
    }
}

