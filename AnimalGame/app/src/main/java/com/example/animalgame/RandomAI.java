package com.example.animalgame;

import java.util.List;
import java.util.Random;

public final class RandomAI {
    private final Random rng;

    public RandomAI(Random rng) {
        this.rng = rng;
    }

    public void playOneTurn(GameEngine game) {
        if (game.isGameOver()) return;

        if (!game.canAct(game.getCurrentSide())) {
            boolean draw = rng.nextBoolean();
            if (draw) {
                game.requestDraw();
            }
            return;
        }

        List<Move> moves = game.listLegalMovesForCurrentSide();
        if (moves.isEmpty()) {
            game.flipRandomFaceDown();
            return;
        }
        Move chosen = moves.get(rng.nextInt(moves.size()));
        game.applyMove(chosen);
    }
}

