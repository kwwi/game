package com.example.animalgame;

import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

import java.util.ArrayList;
import java.util.List;

/**
 * 可序列化的对局整体状态，用于本地持久化和网络同步。
 */
public final class GameState {

    @SerializedName("currentSide")
    public Side currentSide;

    @SerializedName("aCamp")
    public Camp aCamp;

    @SerializedName("bCamp")
    public Camp bCamp;

    @SerializedName("result")
    public GameResult result;

    @SerializedName("pieces")
    public List<StatePiece> pieces = new ArrayList<>();

    @SerializedName("capturedByA")
    public List<StatePiece> capturedByA = new ArrayList<>();

    @SerializedName("capturedByB")
    public List<StatePiece> capturedByB = new ArrayList<>();

    public static final class StatePiece {
        @SerializedName("id")
        public int id;

        @SerializedName("type")
        public PieceType type;

        @SerializedName("camp")
        public Camp camp;

        @SerializedName("faceDown")
        public boolean faceDown;

        @SerializedName("r")
        public Integer r; // 为空表示已被吃掉

        @SerializedName("c")
        public Integer c;
    }

    private static final Gson gson = new Gson();

    public String toJson() {
        return gson.toJson(this);
    }

    public static GameState fromJson(String json) {
        return gson.fromJson(json, GameState.class);
    }
}

