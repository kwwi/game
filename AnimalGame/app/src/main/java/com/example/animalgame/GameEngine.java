package com.example.animalgame;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Random;
import java.util.Set;

public final class GameEngine {
    public static final int ROWS = 7;
    public static final int COLS = 8;

    private final Random rng;
    private final Map<Pos, Piece> board = new HashMap<>();
    private final List<Piece> allPieces = new ArrayList<>();
    private final Set<Pos> specialCells = new HashSet<>(Arrays.asList(
            new Pos(2, 2), new Pos(2, 7),
            new Pos(6, 2), new Pos(6, 7)
    ));

    private Side currentSide = Side.A;
    private Camp aCamp = null;
    private Camp bCamp = null;
    private GameResult result = GameResult.ONGOING;

    public GameEngine(Random rng) {
        this.rng = Objects.requireNonNull(rng);
    }

    public void setCurrentSide(Side side) {
        this.currentSide = side;
    }

    public Side getCurrentSide() {
        return currentSide;
    }

    public Side getWinner() {
        if (result == GameResult.A_WIN) return Side.A;
        if (result == GameResult.B_WIN) return Side.B;
        return null;
    }

    public boolean isGameOver() {
        return result != GameResult.ONGOING;
    }

    public GameResult getResult() {
        return result;
    }

    public boolean requestDraw() {
        if (isGameOver()) return false;
        result = GameResult.DRAW;
        return true;
    }

    public int rollDice() {
        return rng.nextInt(6) + 1;
    }

    public void nextTurn() {
        currentSide = (currentSide == Side.A) ? Side.B : Side.A;
        recomputeResult();
    }

    public Camp getCampOf(Side side) {
        if (side == Side.A) return aCamp;
        return bCamp;
    }

    public void initRandomSetup() {
        board.clear();
        allPieces.clear();
        result = GameResult.ONGOING;
        aCamp = null;
        bCamp = null;

        List<PieceType> pool = new ArrayList<>();
        add(pool, PieceType.WHALE, 2);
        add(pool, PieceType.PHOENIX, 2);
        add(pool, PieceType.DRAGON, 2);
        add(pool, PieceType.ELEPHANT, 2);
        add(pool, PieceType.LION, 2);
        add(pool, PieceType.TIGER, 2);
        add(pool, PieceType.LEOPARD, 2);
        add(pool, PieceType.FORTUNE, 2);
        add(pool, PieceType.WOLF, 2);
        add(pool, PieceType.DOG, 2);
        add(pool, PieceType.CAT, 2);
        add(pool, PieceType.MOUSE, 4);

        List<PieceType> types = new ArrayList<>(pool);
        List<PieceSpawn> spawns = new ArrayList<>(types.size() * 2);
        for (PieceType t : types) spawns.add(new PieceSpawn(t, Camp.RED));
        for (PieceType t : types) spawns.add(new PieceSpawn(t, Camp.BLACK));

        List<Pos> cells = new ArrayList<>();
        for (int r = 1; r <= ROWS; r++) {
            for (int c = 1; c <= COLS; c++) {
                Pos p = new Pos(r, c);
                if (!specialCells.contains(p)) cells.add(p);
            }
        }
        Collections.shuffle(cells, rng);
        Collections.shuffle(spawns, rng);

        int id = 1;
        for (int i = 0; i < spawns.size(); i++) {
            Pos p = cells.get(i);
            PieceSpawn s = spawns.get(i);
            Piece piece = new Piece(id++, s.type, s.camp, p);
            allPieces.add(piece);
            board.put(p, piece);
        }
    }

    public GameState toGameState() {
        GameState state = new GameState();
        state.currentSide = currentSide;
        state.aCamp = aCamp;
        state.bCamp = bCamp;
        state.result = result;
        for (Piece p : allPieces) {
            GameState.StatePiece sp = new GameState.StatePiece();
            sp.id = p.id;
            sp.type = p.type;
            sp.camp = p.camp;
            sp.faceDown = p.faceDown;
            if (p.pos != null) {
                sp.r = p.pos.r;
                sp.c = p.pos.c;
            } else {
                sp.r = null;
                sp.c = null;
            }
            state.pieces.add(sp);
        }
        return state;
    }

    public void loadFromGameState(GameState state) {
        board.clear();
        allPieces.clear();
        if (state == null) {
            initRandomSetup();
            return;
        }
        this.currentSide = state.currentSide != null ? state.currentSide : Side.A;
        this.aCamp = state.aCamp;
        this.bCamp = state.bCamp;
        this.result = state.result != null ? state.result : GameResult.ONGOING;

        if (state.pieces != null) {
            for (GameState.StatePiece sp : state.pieces) {
                Pos pos = (sp.r != null && sp.c != null) ? new Pos(sp.r, sp.c) : null;
                Piece p = new Piece(sp.id, sp.type, sp.camp, pos);
                p.faceDown = sp.faceDown;
                allPieces.add(p);
                if (pos != null) {
                    board.put(pos, p);
                }
            }
        }
    }

    public boolean hasFaceDownPieces() {
        for (Piece p : allPieces) if (p.faceDown) return true;
        return false;
    }

    /** 按坐标翻牌（用于 UI/网络指定位置翻面） */
    public Piece flipAt(int r, int c) {
        if (isGameOver()) return null;
        Pos pos = new Pos(r, c);
        Piece piece = board.get(pos);
        if (piece == null || !piece.faceDown) return null;
        piece.faceDown = false;
        if (aCamp == null && bCamp == null) {
            assignCampsFromFirstReveal(piece.camp);
        }
        recomputeResult();
        return piece;
    }

    private void assignCampsFromFirstReveal(Camp firstCamp) {
        if (currentSide == Side.A) {
            aCamp = firstCamp;
            bCamp = (firstCamp == Camp.RED) ? Camp.BLACK : Camp.RED;
        } else {
            bCamp = firstCamp;
            aCamp = (firstCamp == Camp.RED) ? Camp.BLACK : Camp.RED;
        }
    }

    public List<Move> listLegalMovesForCurrentSide() {
        Camp camp = getCampOf(currentSide);
        if (camp == null) return Collections.emptyList();
        List<Move> moves = new ArrayList<>();
        for (Piece p : allPieces) {
            if (p.pos == null) continue;
            if (p.faceDown) continue;
            if (p.camp != camp) continue;
            moves.addAll(listLegalMovesForPiece(p));
        }
        return moves;
    }

    public List<Move> listLegalMovesForSide(Side side) {
        Camp camp = getCampOf(side);
        if (camp == null) return Collections.emptyList();
        List<Move> moves = new ArrayList<>();
        for (Piece p : allPieces) {
            if (p.pos == null) continue;
            if (p.faceDown) continue;
            if (p.camp != camp) continue;
            moves.addAll(listLegalMovesForPiece(p));
        }
        return moves;
    }

    public List<Move> listLegalMovesForPiece(Piece p) {
        if (p == null || p.pos == null || p.faceDown) return Collections.emptyList();
        List<Move> moves = new ArrayList<>();
        int[][] dirs = { {1,0}, {-1,0}, {0,1}, {0,-1} };
        for (int[] d : dirs) {
            int nr = p.pos.r + d[0];
            int nc = p.pos.c + d[1];
            if (!inBounds(nr, nc)) continue;
            Pos to = new Pos(nr, nc);
            Piece target = board.get(to);
            if (target == null) {
                moves.add(Move.move(p.id, p.pos, to));
            } else {
                if (target.faceDown) continue;
                if (target.camp == p.camp) continue;
                if (isInvincibleCell(to)) continue;
                if (canCapture(p, target)) {
                    moves.add(Move.capture(p.id, p.pos, to, target.id));
                }
            }
        }
        return moves;
    }

    public boolean applyMove(Move move) {
        if (isGameOver()) return false;
        if (move == null) return false;
        Piece mover = findById(move.moverId);
        if (mover == null || mover.faceDown) return false;
        Camp camp = getCampOf(currentSide);
        if (camp == null || mover.camp != camp) return false;
        if (!mover.pos.equals(move.from)) return false;
        if (!inBounds(move.to.r, move.to.c)) return false;
        if (!mover.pos.isAdjacent4(move.to)) return false;

        Piece target = board.get(move.to);
        if (!move.isCapture) {
            if (target != null) return false;
            movePiece(mover, move.to);
            recomputeResult();
            return true;
        } else {
            if (target == null) return false;
            if (target.faceDown) return false;
            if (target.id != move.capturedId) return false;
            if (target.camp == mover.camp) return false;
            if (isInvincibleCell(move.to)) return false;
            if (!canCapture(mover, target)) return false;
            capture(mover, target);
            recomputeResult();
            return true;
        }
    }

    public boolean canAct(Side side) {
        if (isGameOver()) return false;
        if (hasFaceDownPieces()) return true;
        return !listLegalMovesForSide(side).isEmpty();
    }

    public Piece getPieceAt(int r, int c) {
        return board.get(new Pos(r, c));
    }

    public boolean isSpecialCell(int r, int c) {
        return specialCells.contains(new Pos(r, c));
    }

    private void movePiece(Piece p, Pos to) {
        board.remove(p.pos);
        p.pos = to;
        board.put(to, p);
    }

    private void capture(Piece attacker, Piece defender) {
        board.remove(defender.pos);
        movePiece(attacker, defender.pos);
        defender.pos = null;
        defender.faceDown = false;
    }

    private boolean canCapture(Piece attacker, Piece defender) {
        if (attacker == null || defender == null) return false;
        if (attacker.faceDown || defender.faceDown) return false;
        if (attacker.camp == defender.camp) return false;
        if (attacker.pos == null || defender.pos == null) return false;
        if (!attacker.pos.isAdjacent4(defender.pos)) return false;
        if (attacker.type == PieceType.MOUSE && defender.type == PieceType.WHALE) return true;
        return attacker.type.rank > defender.type.rank;
    }

    private boolean isInvincibleCell(Pos pos) {
        return specialCells.contains(pos);
    }

    private boolean inBounds(int r, int c) {
        return r >= 1 && r <= ROWS && c >= 1 && c <= COLS;
    }

    private Piece findById(int id) {
        for (Piece p : allPieces) if (p.id == id) return p;
        return null;
    }

    private void recomputeResult() {
        if (result != GameResult.ONGOING) return;
        if (aCamp == null || bCamp == null) return;

        int aCount = 0, bCount = 0;
        for (Piece p : allPieces) {
            if (p.pos == null) continue;
            if (p.camp == aCamp) aCount++;
            if (p.camp == bCamp) bCount++;
        }

        if (aCount == 0 && bCount == 0) { result = GameResult.DRAW; return; }
        if (aCount == 0) { result = GameResult.B_WIN; return; }
        if (bCount == 0) { result = GameResult.A_WIN; return; }

        if (!hasFaceDownPieces()) {
            boolean aCan = !listLegalMovesForSide(Side.A).isEmpty();
            boolean bCan = !listLegalMovesForSide(Side.B).isEmpty();
            if (!aCan && !bCan) { result = GameResult.DRAW; return; }
            if (currentSide == Side.A && !aCan) { result = GameResult.B_WIN; return; }
            if (currentSide == Side.B && !bCan) { result = GameResult.A_WIN; }
        }
    }

    private static void add(List<PieceType> list, PieceType t, int n) {
        for (int i = 0; i < n; i++) list.add(t);
    }

    private static final class PieceSpawn {
        final PieceType type;
        final Camp camp;
        PieceSpawn(PieceType type, Camp camp) { this.type = type; this.camp = camp; }
    }
}

