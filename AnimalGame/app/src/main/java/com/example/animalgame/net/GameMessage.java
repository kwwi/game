package com.example.animalgame.net;

import com.example.animalgame.GameState;
import com.example.animalgame.Move;
import com.google.gson.Gson;
import com.google.gson.annotations.SerializedName;

/**
 * 简单的网络消息模型，用 JSON 在线路上传输。
 */
public final class GameMessage {

    public enum Type {
        @SerializedName("sync") SYNC_STATE,
        @SerializedName("move") MOVE,
        @SerializedName("chat") CHAT
    }

    @SerializedName("type")
    public Type type;

    @SerializedName("state")
    public GameState state; // SYNC_STATE 时使用

    @SerializedName("move")
    public Move move;       // MOVE 时使用

    @SerializedName("text")
    public String text;     // CHAT 时使用

    private static final Gson gson = new Gson();

    public String toJson() {
        return gson.toJson(this);
    }

    public static GameMessage fromJson(String json) {
        return gson.fromJson(json, GameMessage.class);
    }
}

