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
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> frame = objectMapper.readValue(message.getPayload(), new TypeReference<>() {});
        String type = (String) frame.get("type");
        String sessionId = (String) session.getAttributes().get("sessionId");

        switch (type) {
            case "start_session" -> handleStartSession(session, sessionId, frame);
            case "user_message" -> handleUserMessage(session, sessionId, frame);
            case "resume_session" -> handleResumeSession(session, sessionId, frame);
            default -> log.warn("Unknown frame type '{}' from sessionId={}", type, sessionId);
        }
    }

    private void handleStartSession(WebSocketSession session, String sessionId, Map<String, Object> frame) throws Exception {
        Map<String, Object> variables = new HashMap<>();
        variables.put("sessionId", sessionId);

        String processInstanceKey = camundaClient.createProcessInstance(variables);

        sessionStore.register(sessionId, session, processInstanceKey);
        log.info("Session started: sessionId={}, processInstanceKey={}", sessionId, processInstanceKey);

        Map<String, Object> response = Map.of(
            "type", "session_ready",
            "processInstanceKey", processInstanceKey
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
    }

    private void handleUserMessage(WebSocketSession session, String sessionId, Map<String, Object> frame) throws Exception {
        SessionStore.SessionEntry entry = sessionStore.getBySessionId(sessionId);
        if (entry == null) {
            log.warn("user_message with no active session: sessionId={}", sessionId);
            sendError(session, "No active session. Send start_session first.");
            return;
        }

        String content = (String) frame.get("content");
        Map<String, Object> variables = Map.of("userMessage", content != null ? content : "");

        camundaClient.publishMessage("user_input_received", entry.processInstanceKey, variables);
        log.info("Published user_input_received: processInstanceKey={}", entry.processInstanceKey);
    }

    private void handleResumeSession(WebSocketSession session, String sessionId, Map<String, Object> frame) throws Exception {
        String processInstanceKey = (String) frame.get("processInstanceKey");
        if (processInstanceKey == null) {
            sendError(session, "processInstanceKey is required to resume a session.");
            return;
        }

        sessionStore.reAssociateWebSocket(processInstanceKey, session);
        session.getAttributes().put("sessionId", sessionId);
        log.info("Session resumed: processInstanceKey={}", processInstanceKey);

        Map<String, Object> response = Map.of(
            "type", "session_resumed",
            "processInstanceKey", processInstanceKey
        );
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(response)));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String sessionId = (String) session.getAttributes().get("sessionId");
        if (sessionId != null) {
            sessionStore.markDisconnected(sessionId);
            log.info("WebSocket disconnected: sessionId={}, status={}", sessionId, status);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        String sessionId = (String) session.getAttributes().get("sessionId");
        log.error("WebSocket transport error: sessionId={}", sessionId, exception);
    }

    private void sendError(WebSocketSession session, String message) throws Exception {
        Map<String, Object> frame = Map.of("type", "error", "content", message);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(frame)));
    }
}
