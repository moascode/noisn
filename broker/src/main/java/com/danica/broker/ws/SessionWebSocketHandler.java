package com.danica.broker.ws;

import com.danica.broker.camunda.CamundaClient;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class SessionWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(SessionWebSocketHandler.class);

    private final SessionStore sessionStore;
    private final CamundaClient camundaClient;
    private final ObjectMapper objectMapper;

    public SessionWebSocketHandler(SessionStore sessionStore, CamundaClient camundaClient, ObjectMapper objectMapper) {
        this.sessionStore = sessionStore;
        this.camundaClient = camundaClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String sessionId = UUID.randomUUID().toString();
        session.getAttributes().put("sessionId", sessionId);
        log.info("WebSocket connection established: sessionId={}", sessionId);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        Map<String, Object> frame;
        try {
            frame = objectMapper.readValue(message.getPayload(), new TypeReference<>() {});
        } catch (Exception e) {
            sendError(session, "Invalid JSON frame");
            return;
        }

        String type = (String) frame.get("type");
        String sessionId = (String) session.getAttributes().get("sessionId");

        if (type == null) {
            log.warn("Frame missing 'type' field from sessionId={}", sessionId);
            sendError(session, "Frame missing required 'type' field");
            return;
        }

        switch (type) {
            case "start_session" -> handleStartSession(session, sessionId, frame);
            case "user_message" -> handleUserMessage(session, sessionId, frame);
            case "resume_session" -> handleResumeSession(session, sessionId, frame);
            default -> log.warn("Unknown frame type '{}' from sessionId={}", type, sessionId);
        }
    }

    private void handleStartSession(WebSocketSession session, String sessionId, Map<String, Object> frame) throws IOException {
        Map<String, Object> variables = new HashMap<>();
        variables.put("sessionId", sessionId);

        String processInstanceKey;
        try {
            processInstanceKey = camundaClient.createProcessInstance(variables);
        } catch (Exception e) {
            log.error("Failed to create Camunda process instance for sessionId={}", sessionId, e);
            sendError(session, "Failed to start session: " + e.getMessage());
            return;
        }

        sessionStore.register(sessionId, session, processInstanceKey);
        log.info("Session started: sessionId={}, processInstanceKey={}", sessionId, processInstanceKey);

        sendFrame(session, Map.of(
            "type", "session_ready",
            "processInstanceKey", processInstanceKey
        ));
    }

    private void handleUserMessage(WebSocketSession session, String sessionId, Map<String, Object> frame) throws IOException {
        SessionStore.SessionEntry entry = sessionStore.getBySessionId(sessionId);
        if (entry == null) {
            log.warn("user_message with no active session: sessionId={}", sessionId);
            sendError(session, "No active session. Send start_session first.");
            return;
        }

        String content = (String) frame.get("content");
        Map<String, Object> variables = Map.of("userMessage", content != null ? content : "");

        try {
            // Correlate by sessionId — the process variable set at creation time
            camundaClient.publishMessage("user_input_received", entry.getSessionId(), variables);
            log.info("Published user_input_received: processInstanceKey={}", entry.getProcessInstanceKey());
        } catch (Exception e) {
            log.error("Failed to publish message for processInstanceKey={}", entry.getProcessInstanceKey(), e);
            sendError(session, "Failed to deliver message: " + e.getMessage());
        }
    }

    private void handleResumeSession(WebSocketSession session, String sessionId, Map<String, Object> frame) throws IOException {
        String processInstanceKey = (String) frame.get("processInstanceKey");
        if (processInstanceKey == null) {
            sendError(session, "processInstanceKey is required to resume a session.");
            return;
        }

        // Reuse the OLD session ID so afterConnectionClosed cleans up the right entry
        String oldSessionId = sessionStore.reAssociateWebSocket(processInstanceKey, session);
        if (oldSessionId == null) {
            sendError(session, "Session not found for processInstanceKey: " + processInstanceKey);
            return;
        }

        session.getAttributes().put("sessionId", oldSessionId);
        log.info("Session resumed: oldSessionId={}, processInstanceKey={}", oldSessionId, processInstanceKey);

        sendFrame(session, Map.of(
            "type", "session_resumed",
            "processInstanceKey", processInstanceKey
        ));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = (String) session.getAttributes().get("sessionId");
        if (sessionId != null) {
            // Mark disconnected but keep the entry — the client may resume_session
            sessionStore.markDisconnected(sessionId);
            log.info("WebSocket disconnected: sessionId={}, status={}", sessionId, status);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        String sessionId = (String) session.getAttributes().get("sessionId");
        log.error("WebSocket transport error: sessionId={}", sessionId, exception);
    }

    /** Thread-safe frame send; serialises concurrent writes to the same socket. */
    private void sendFrame(WebSocketSession session, Map<String, Object> payload) throws IOException {
        String json = objectMapper.writeValueAsString(payload);
        synchronized (session) {
            session.sendMessage(new TextMessage(json));
        }
    }

    private void sendError(WebSocketSession session, String message) throws IOException {
        sendFrame(session, Map.of("type", "error", "content", message));
    }
}
