package com.example.animalgame.net;

import android.util.Log;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 非阻塞的简单 TCP 客户端，用于两端之间转发 GameMessage JSON。
 * 这是一个示例实现，实际项目中可以替换为 WebSocket / 自己的后端协议。
 */
public final class GameNetworkClient {

    public interface Listener {
        void onConnected();
        void onDisconnected(Exception e);
        void onMessageReceived(String json);
    }

    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private Socket socket;
    private PrintWriter writer;
    private Listener listener;

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    public void connect(String host, int port) {
        ioExecutor.execute(() -> {
            try {
                socket = new Socket();
                socket.connect(new InetSocketAddress(host, port), 5000);
                writer = new PrintWriter(socket.getOutputStream(), true);

                if (listener != null) listener.onConnected();

                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(socket.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (listener != null) listener.onMessageReceived(line);
                }
            } catch (Exception e) {
                if (listener != null) listener.onDisconnected(e);
            } finally {
                close();
            }
        });
    }

    public void send(String jsonLine) {
        ioExecutor.execute(() -> {
            if (writer != null) {
                writer.println(jsonLine);
            } else {
                Log.w("GameNetworkClient", "send called but writer is null");
            }
        });
    }

    public void close() {
        try {
            if (writer != null) writer.close();
        } catch (Exception ignored) {}
        try {
            if (socket != null && !socket.isClosed()) {
                socket.close();
            }
        } catch (IOException ignored) {}
    }
}

