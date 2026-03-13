package com.example.animalgameweb.core;

import java.util.Objects;

public final class Pos {
    public final int r;
    public final int c;

    public Pos(int r, int c) {
        this.r = r;
        this.c = c;
    }

    public boolean isAdjacent4(Pos other) {
        int dr = Math.abs(this.r - other.r);
        int dc = Math.abs(this.c - other.c);
        return (dr + dc) == 1;
    }

    @Override public boolean equals(Object o) {
        if (!(o instanceof Pos)) return false;
        Pos p = (Pos) o;
        return r == p.r && c == p.c;
    }

    @Override public int hashCode() {
        return Objects.hash(r, c);
    }
}

