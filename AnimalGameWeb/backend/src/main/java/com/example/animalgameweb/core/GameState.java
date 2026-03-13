package com.example.animalgameweb.core;

import java.util.ArrayList;
import java.util.List;

public final class GameState {
    public int rows;
    public int cols;
    public Side currentSide;
    public Camp aCamp;
    public Camp bCamp;
    public GameResult result;
    public List<StatePiece> pieces = new ArrayList<>();
    /** A方被吃的棋子（属于aCamp的棋子被吃掉） */
    public List<StatePiece> capturedByA = new ArrayList<>();
    /** B方被吃的棋子（属于bCamp的棋子被吃掉） */
    public List<StatePiece> capturedByB = new ArrayList<>();

    public static final class StatePiece {
        public int id;
        public PieceType type;
        public Camp camp;
        public boolean faceDown;
        public Integer r; // null 被吃
        public Integer c;
    }
}

