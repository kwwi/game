package com.example.animalgame;

import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import java.util.Random;

public class GameActivity extends AppCompatActivity {

    private GameEngine game;
    private RandomAI ai;
    private GridLayout gridBoard;
    private TextView tvStatus;
    private TextView tvCapturedRed;
    private TextView tvCapturedBlack;

    private View[][] cellViews = new View[GameEngine.ROWS][GameEngine.COLS];

    private Integer selectedPieceId = null;
    private int selectedRow = -1;
    private int selectedCol = -1;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_game);

        tvStatus = findViewById(R.id.tvStatus);
        tvCapturedRed = findViewById(R.id.tvCapturedRed);
        tvCapturedBlack = findViewById(R.id.tvCapturedBlack);
        gridBoard = findViewById(R.id.gridBoard);
        Button btnFlip = findViewById(R.id.btnFlip);
        Button btnNext = findViewById(R.id.btnNext);

        Random rng = new Random();
        game = new GameEngine(rng);
        ai = new RandomAI(rng);

        int a = game.rollDice();
        int b = game.rollDice();
        while (a == b) {
            a = game.rollDice();
            b = game.rollDice();
        }
        Side first = (a > b) ? Side.A : Side.B;
        game.setCurrentSide(first);
        game.initRandomSetup();

        initBoardViews();
        refreshBoard();

        btnFlip.setOnClickListener(v -> Toast.makeText(this, "点击未翻面的棋子即可翻面", Toast.LENGTH_SHORT).show());

        btnNext.setOnClickListener(v -> {
            if (game.isGameOver()) {
                Toast.makeText(this, "对局已结束", Toast.LENGTH_SHORT).show();
                return;
            }
            ai.playOneTurn(game);
            game.nextTurn();
            clearSelection();
            refreshBoard();
        });
    }

    private void initBoardViews() {
        gridBoard.removeAllViews();
        for (int r = 0; r < GameEngine.ROWS; r++) {
            for (int c = 0; c < GameEngine.COLS; c++) {
                TextView cell = new TextView(this);
                GridLayout.LayoutParams lp = new GridLayout.LayoutParams(
                        GridLayout.spec(r, 1f),
                        GridLayout.spec(c, 1f)
                );
                lp.width = 0;
                lp.height = 0;
                cell.setLayoutParams(lp);
                cell.setGravity(Gravity.CENTER);
                cell.setTextSize(12);
                cell.setPadding(2, 2, 2, 2);
                cell.setTextColor(0xFFFFFFFF);

                gridBoard.addView(cell);
                cellViews[r][c] = cell;

                final int fr = r + 1;
                final int fc = c + 1;
                cell.setOnClickListener(v -> onCellClicked(fr, fc));
            }
        }
    }

    private void onCellClicked(int r, int c) {
        if (game.isGameOver()) return;

        Piece piece = game.getPieceAt(r, c);
        Camp currentCamp = game.getCampOf(game.getCurrentSide());

        if (selectedPieceId == null) {
            if (piece == null) return;
            if (piece.faceDown) {
                if (game.flipAt(r, c) != null && !game.isGameOver()) {
                    game.nextTurn();
                }
                refreshBoard();
                return;
            }
            if (currentCamp == null || piece.camp != currentCamp) {
                Toast.makeText(this, "不是当前阵营的棋子", Toast.LENGTH_SHORT).show();
                return;
            }
            selectedPieceId = piece.id;
            selectedRow = r;
            selectedCol = c;
            refreshBoard();
            return;
        }

        if (r == selectedRow && c == selectedCol) {
            clearSelection();
            refreshBoard();
            return;
        }

        Move moveToApply = null;
        for (Move m : game.listLegalMovesForCurrentSide()) {
            if (m.moverId == selectedPieceId &&
                    m.to.r == r && m.to.c == c) {
                moveToApply = m;
                break;
            }
        }

        if (moveToApply == null) {
            if (piece != null && !piece.faceDown &&
                    currentCamp != null && piece.camp == currentCamp) {
                selectedPieceId = piece.id;
                selectedRow = r;
                selectedCol = c;
                refreshBoard();
            } else {
                Toast.makeText(this, "该位置不可达", Toast.LENGTH_SHORT).show();
            }
            return;
        }

        boolean ok = game.applyMove(moveToApply);
        if (!ok) {
            Toast.makeText(this, "走子失败（规则不允许）", Toast.LENGTH_SHORT).show();
            clearSelection();
            refreshBoard();
            return;
        }

        clearSelection();
        if (!game.isGameOver()) {
            game.nextTurn();
        }
        refreshBoard();

        if (game.isGameOver()) {
            Toast.makeText(this, "对局结束: " + game.getResult(), Toast.LENGTH_LONG).show();
        }
    }

    private void clearSelection() {
        selectedPieceId = null;
        selectedRow = -1;
        selectedCol = -1;
    }

    private void refreshBoard() {
        tvStatus.setText(
                "当前回合: " + game.getCurrentSide() +
                        " 阵营: " + game.getCampOf(game.getCurrentSide()) +
                        " 结果: " + game.getResult()
        );

        for (int r = 1; r <= GameEngine.ROWS; r++) {
            for (int c = 1; c <= GameEngine.COLS; c++) {
                TextView cell = (TextView) cellViews[r - 1][c - 1];

                boolean isSpecial = game.isSpecialCell(r, c);
                boolean isSelected = (selectedPieceId != null &&
                        r == selectedRow && c == selectedCol);

                if (isSelected) {
                    cell.setBackgroundColor(0xFF6B8E6B);
                } else if (isSpecial) {
                    cell.setBackgroundColor(0xFF4a5560);
                } else {
                    cell.setBackgroundColor(0xFF2d4a3d);
                }

                Piece piece = game.getPieceAt(r, c);
                if (piece == null) {
                    cell.setText("");
                    cell.setTextColor(0xFF8a9a8e);
                } else if (piece.faceDown) {
                    cell.setText("？");
                    cell.setTextColor(0xFF6a7a6e);
                } else {
                    cell.setText(piece.type.zh);
                    cell.setTextColor(piece.camp == Camp.RED ? 0xFFe53935 : 0xFF1a1a1a);
                }
            }
        }
        StringBuilder red = new StringBuilder();
        StringBuilder black = new StringBuilder();
        Camp aCamp = game.getCampOf(Side.A);
        Camp bCamp = game.getCampOf(Side.B);
        for (Piece p : game.getCapturedByA()) {
            if (p.camp == Camp.RED) red.append(p.type.zh).append(" ");
            else black.append(p.type.zh).append(" ");
        }
        for (Piece p : game.getCapturedByB()) {
            if (p.camp == Camp.RED) red.append(p.type.zh).append(" ");
            else black.append(p.type.zh).append(" ");
        }
        if (tvCapturedRed != null) tvCapturedRed.setText("红方被吃：" + (red.length() > 0 ? red.toString().trim() : "无"));
        if (tvCapturedBlack != null) tvCapturedBlack.setText("黑方被吃：" + (black.length() > 0 ? black.toString().trim() : "无"));
    }
}

