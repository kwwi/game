package com.example.animalgameweb.api;

import com.example.animalgameweb.core.GameState;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "*")
public class RoomController {

    private final GameService service;

    public RoomController(GameService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<GameService.RoomInfo>> listRooms() {
        return ResponseEntity.ok(service.listRooms());
    }

    @PostMapping("quick-join")
    public ResponseEntity<GameService.GameCreatedResponse> quickJoin(
            @RequestBody GameService.JoinGameRequest req) {
        GameService.GameCreatedResponse resp = service.quickJoin(req);
        if (resp == null) return ResponseEntity.badRequest().build();
        return ResponseEntity.ok(resp);
    }

    @PostMapping("{id}/join")
    public ResponseEntity<GameService.GameCreatedResponse> joinRoom(
            @PathVariable String id,
            @RequestBody GameService.JoinGameRequest req) {
        GameService.GameCreatedResponse resp = service.joinRoom(id, req);
        if (resp == null) return ResponseEntity.status(404).build();
        return ResponseEntity.ok(resp);
    }
}
