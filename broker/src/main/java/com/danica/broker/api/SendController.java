package com.danica.broker.api;

import com.danica.broker.ws.SessionStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.Map;

// Authentication for this endpoint is enforced by InternalApiKeyFilter (X-Internal-Api-Key header)
@RestController
@RequestMapping("/internal")
public class SendController {

    private static final Logger log = LoggerFactory.getLogger(SendController.class);

    private final SessionStore sessionStore;
    private final ObjectMapper objectMapper;

    public SendController(SessionStore sessionStore, ObjectMapper objectMapper) {
        this.sessionStore = sessionStore;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/send")
    public ResponseEntity<Map<String, String>> send(@RequestBody SendRequest req) {
        SessionStore.SessionEntry entry = sessionStore.getByProcessInstanceKey(req.processInstanceKey());
        if (entry == null) {
            log.warn("No session found for processInstanceKey={}", req.processInstanceKey());
            return ResponseEntity.status(404).body(Map.of("status", "session_not_found"));
        }

        WebSocketSession ws = entry.getWs();
        if (ws == null || !ws.isOpen()) {
            log.warn("Session disconnected for processInstanceKey={}", req.processInstanceKey());
            return ResponseEntity.status(503).body(Map.of("status", "session_not_connected"));
        }

        try {
            Map<String, Object> frame = Map.of(
                "type", req.messageType(),
                "content", req.payload() != null ? req.payload() : Map.of()
            );
            String json = objectMapper.writeValueAsString(frame);
            // Synchronize on ws to serialise concurrent sends from multiple workers
            synchronized (ws) {
                ws.sendMessage(new TextMessage(json));
            }
            log.info("Delivered frame type='{}' to processInstanceKey={}", req.messageType(), req.processInstanceKey());
            return ResponseEntity.ok(Map.of("status", "delivered"));
        } catch (IOException e) {
            log.error("Failed to send WebSocket message to processInstanceKey={}", req.processInstanceKey(), e);
            return ResponseEntity.status(503).body(Map.of("status", "send_failed", "error", e.getMessage()));
        }
    }

    public record SendRequest(String processInstanceKey, String messageType, Object payload) {}
}
