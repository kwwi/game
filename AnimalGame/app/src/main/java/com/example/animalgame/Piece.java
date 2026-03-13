package com.example.animalgame;

public final class Piece {
    public final int id;
    public final PieceType type;
    public final Camp camp;
    public boolean faceDown = true;
    public Pos pos;

    public Piece(int id, PieceType type, Camp camp, Pos pos) {
        this.id = id;
        this.type = type;
        this.camp = camp;
        this.pos = pos;
    }
}

