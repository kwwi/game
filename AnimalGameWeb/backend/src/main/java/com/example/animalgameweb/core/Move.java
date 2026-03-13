package com.example.animalgameweb.core;

public final class Move {
    public int moverId;
    public Pos from;
    public Pos to;
    public boolean capture;
    public Integer capturedId;

    public static Move move(int moverId, Pos from, Pos to) {
        Move m = new Move();
        m.moverId = moverId;
        m.from = from;
        m.to = to;
        m.capture = false;
        m.capturedId = null;
        return m;
    }

    public static Move capture(int moverId, Pos from, Pos to, int capturedId) {
        Move m = new Move();
        m.moverId = moverId;
        m.from = from;
        m.to = to;
        m.capture = true;
        m.capturedId = capturedId;
        return m;
    }
}

