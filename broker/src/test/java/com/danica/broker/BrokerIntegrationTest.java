package com.danica.broker;

import com.danica.broker.camunda.CamundaClient;
import com.danica.broker.ws.SessionStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BrokerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private SessionStore sessionStore;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private CamundaClient camundaClient;

    @Value("${broker.internal-api-key}")
    private String internalApiKey;

    @BeforeEach
    void cleanStore() {
        // Remove any sessions registered by previous tests
        sessionStore.remove("test-session-id");
        sessionStore.remove("disconnected-session");
        sessionStore.remove("resume-old-session");
    }

    // ── /internal/send — authentication ──────────────────────────────────────

    @Test
    void internalSend_missingApiKey_returns401() throws Exception {
        mockMvc.perform(post("/internal/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "processInstanceKey", "any",
                    "messageType", "question",
                    "payload", Map.of()))))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void internalSend_wrongApiKey_returns401() throws Exception {
        mockMvc.perform(post("/internal/send")
                .header("X-Internal-Api-Key", "wrong-key")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "processInstanceKey", "any",
                    "messageType", "question",
                    "payload", Map.of()))))
            .andExpect(status().isUnauthorized());
    }

    // ── /internal/send — session routing ─────────────────────────────────────

    @Test
    void internalSend_knownOpenSession_delivers200AndSendsFrame() throws Exception {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        when(mockWs.isOpen()).thenReturn(true);

        sessionStore.register("test-session-id", mockWs, "pik-12345");

        mockMvc.perform(post("/internal/send")
                .header("X-Internal-Api-Key", internalApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "processInstanceKey", "pik-12345",
                    "messageType", "question",
                    "payload", Map.of("text", "How old are you?")))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("delivered"));

        verify(mockWs).sendMessage(any(TextMessage.class));
    }

    @Test
    void internalSend_unknownProcessInstanceKey_returns404() throws Exception {
        mockMvc.perform(post("/internal/send")
                .header("X-Internal-Api-Key", internalApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "processInstanceKey", "non-existent-key",
                    "messageType", "question",
                    "payload", Map.of()))))
            .andExpect(status().isNotFound());
    }

    @Test
    void internalSend_disconnectedSocket_returns503() throws Exception {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        when(mockWs.isOpen()).thenReturn(false);

        sessionStore.register("disconnected-session", mockWs, "pik-disconnected");

        mockMvc.perform(post("/internal/send")
                .header("X-Internal-Api-Key", internalApiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "processInstanceKey", "pik-disconnected",
                    "messageType", "agent_message",
                    "payload", Map.of("text", "Hello")))))
            .andExpect(status().isServiceUnavailable());
    }

    // ── SessionStore — registration and cleanup ───────────────────────────────

    @Test
    void sessionStore_register_canLookupByBothKeys() {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        sessionStore.register("sid-abc", mockWs, "pik-abc");

        assertThat(sessionStore.getBySessionId("sid-abc")).isNotNull();
        assertThat(sessionStore.getByProcessInstanceKey("pik-abc")).isNotNull();
        assertThat(sessionStore.getByProcessInstanceKey("pik-abc").getSessionId()).isEqualTo("sid-abc");

        sessionStore.remove("sid-abc");
    }

    @Test
    void sessionStore_remove_cleansUpBothMaps() {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        sessionStore.register("sid-cleanup", mockWs, "pik-cleanup");
        sessionStore.remove("sid-cleanup");

        assertThat(sessionStore.getBySessionId("sid-cleanup")).isNull();
        assertThat(sessionStore.getByProcessInstanceKey("pik-cleanup")).isNull();
    }

    @Test
    void sessionStore_markDisconnected_keepsEntryForResume() {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        sessionStore.register("sid-dc", mockWs, "pik-dc");
        sessionStore.markDisconnected("sid-dc");

        SessionStore.SessionEntry entry = sessionStore.getBySessionId("sid-dc");
        assertThat(entry).isNotNull();
        assertThat(entry.getState()).isEqualTo(SessionStore.SessionState.DISCONNECTED);
        assertThat(entry.getDisconnectedAt()).isNotNull();

        sessionStore.remove("sid-dc");
    }

    @Test
    void sessionStore_reAssociate_updatesWsAndReturnsOldSessionId() {
        WebSocketSession oldWs = mock(WebSocketSession.class);
        WebSocketSession newWs = mock(WebSocketSession.class);
        when(newWs.isOpen()).thenReturn(true);

        sessionStore.register("resume-old-session", oldWs, "pik-resume");
        sessionStore.markDisconnected("resume-old-session");

        String returnedId = sessionStore.reAssociateWebSocket("pik-resume", newWs);

        assertThat(returnedId).isEqualTo("resume-old-session");
        SessionStore.SessionEntry entry = sessionStore.getByProcessInstanceKey("pik-resume");
        assertThat(entry.getWs()).isSameAs(newWs);
        assertThat(entry.getState()).isEqualTo(SessionStore.SessionState.ACTIVE);
        assertThat(entry.getDisconnectedAt()).isNull();

        sessionStore.remove("resume-old-session");
    }

    @Test
    void sessionStore_reAssociate_unknownKey_returnsNull() {
        WebSocketSession newWs = mock(WebSocketSession.class);
        String result = sessionStore.reAssociateWebSocket("pik-nonexistent", newWs);
        assertThat(result).isNull();
    }

    // ── Actuator health ───────────────────────────────────────────────────────

    @Test
    void actuatorHealth_returns200() throws Exception {
        mockMvc.perform(post("/actuator/health"))
            .andExpect(status().isMethodNotAllowed()); // POST not allowed, but endpoint exists

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/actuator/health"))
            .andExpect(status().isOk());
    }
}
