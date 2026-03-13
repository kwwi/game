package com.example.animalgameweb.core;

public enum PieceType {
    WHALE("鲸", 12),
    PHOENIX("凤", 11),
    DRAGON("龙", 10),
    ELEPHANT("象", 9),
    LION("狮", 8),
    TIGER("虎", 7),
    LEOPARD("豹", 6),
    FORTUNE("财", 5),
    WOLF("狼", 4),
    DOG("狗", 3),
    CAT("猫", 2),
    MOUSE("鼠", 1);

    public final String zh;
    public final int rank;

    PieceType(String zh, int rank) {
        this.zh = zh;
        this.rank = rank;
    }
}

