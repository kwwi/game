package com.example.animalgame;

public final class Move {
    public final int moverId;
    public final Pos from;
    public final Pos to;
    public final boolean isCapture;
    public final Integer capturedId;

    private Move(int moverId, Pos from, Pos to, boolean isCapture, Integer capturedId) {
        this.moverId = moverId;
        this.from = from;
        this.to = to;
        this.isCapture = isCapture;
        this.capturedId = capturedId;
    }

    public static Move move(int moverId, Pos from, Pos to) {
        return new Move(moverId, from, to, false, null);
    }

    public static Move capture(int moverId, Pos from, Pos to, int capturedId) {
        return new Move(moverId, from, to, true, capturedId);
    }
}

