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

    public static final class StatePiece {
        public int id;
        public PieceType type;
        public Camp camp;
        public boolean faceDown;
        public Integer r; // null 被吃
        public Integer c;
    }
}

