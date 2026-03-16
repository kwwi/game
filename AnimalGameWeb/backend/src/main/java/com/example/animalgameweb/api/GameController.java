package com.example.animalgameweb.api;

import com.example.animalgameweb.core.GameState;
import com.example.animalgameweb.core.Move;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/games")
@CrossOrigin(origins = "*")
public class GameController {

    private final GameService service;

    public GameController(GameService service) {
        this.service = service;
    }

    @GetMapping("{id}")
    public ResponseEntity<GameState> getState(@PathVariable String id) {
        GameState state = service.getState(id);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }

    @PostMapping("{id}/flip")
    public ResponseEntity<GameState> flip(@PathVariable String id,
                                          @RequestParam("username") String username,
                                          @RequestBody GameService.FlipRequest req) {
        GameState state = service.flip(id, username, req);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }

    @PostMapping("{id}/move")
    public ResponseEntity<GameState> move(@PathVariable String id,
                                          @RequestParam("username") String username,
                                          @RequestBody Move move) {
        GameState state = service.move(id, username, move);
        if (state == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(state);
    }
}

