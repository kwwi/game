package com.example.animalgameweb.api;

import com.example.animalgameweb.core.GameEngine;
import com.example.animalgameweb.core.GameState;
import com.example.animalgameweb.core.Move;
import com.example.animalgameweb.core.Side;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GameService {

    private final Map<String, GameSession> games = new ConcurrentHashMap<>();
    private final Random rng = new Random();

    public GameCreatedResponse createGame(CreateGameRequest req) {
        String username = (req != null && req.username != null && !req.username.isEmpty())
                ? req.username : "PlayerA";
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

        String id = UUID.randomUUID().toString();
        GameSession session = new GameSession();
        session.engine = engine;
        session.playerA = username;
        session.playerB = null;
        games.put(id, session);

        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = id;
        resp.state = engine.toGameState();
        resp.side = Side.A;
        return resp;
    }

    public GameState getState(String gameId) {
        GameSession session = games.get(gameId);
        if (session == null) return null;
        return session.engine.toGameState();
    }

    public GameCreatedResponse joinGame(String gameId, JoinGameRequest req) {
        GameSession session = games.get(gameId);
        if (session == null || req == null || req.username == null) return null;
        String username = req.username;

        Side side;
        if (username.equals(session.playerA)) {
            side = Side.A;
        } else if (session.playerB != null && username.equals(session.playerB)) {
            side = Side.B;
        } else if (session.playerB == null) {
            session.playerB = username;
            side = Side.B;
        } else {
            return null;
        }

        GameCreatedResponse resp = new GameCreatedResponse();
        resp.gameId = gameId;
        resp.state = session.engine.toGameState();
        resp.side = side;
        return resp;
    }

    public GameState flip(String gameId, String username, FlipRequest req) {
        GameSession session = games.get(gameId);
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
        GameSession session = games.get(gameId);
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
}

