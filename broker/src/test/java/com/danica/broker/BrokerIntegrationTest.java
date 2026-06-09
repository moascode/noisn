package com.danica.broker;

import com.danica.broker.camunda.CamundaClient;
import com.danica.broker.ws.SessionStore;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class BrokerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private SessionStore sessionStore;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private CamundaClient camundaClient;

    @Test
    void postToInternalSend_withKnownProcessInstanceKey_returns200Delivered() throws Exception {
        // Register a mock WebSocket session
        WebSocketSession mockWs = mock(WebSocketSession.class);
        when(mockWs.isOpen()).thenReturn(true);

        sessionStore.register("test-session-id", mockWs, "pik-12345");

        Map<String, Object> body = Map.of(
            "processInstanceKey", "pik-12345",
            "messageType", "question",
            "payload", Map.of("text", "How old are you?")
        );

        mockMvc.perform(post("/internal/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("delivered"));

        verify(mockWs).sendMessage(any(TextMessage.class));
    }

    @Test
    void postToInternalSend_withUnknownProcessInstanceKey_returns404() throws Exception {
        Map<String, Object> body = Map.of(
            "processInstanceKey", "non-existent-key",
            "messageType", "question",
            "payload", Map.of()
        );

        mockMvc.perform(post("/internal/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isNotFound());
    }

    @Test
    void postToInternalSend_withDisconnectedSocket_returns503() throws Exception {
        WebSocketSession mockWs = mock(WebSocketSession.class);
        when(mockWs.isOpen()).thenReturn(false);

        sessionStore.register("disconnected-session", mockWs, "pik-disconnected");

        Map<String, Object> body = Map.of(
            "processInstanceKey", "pik-disconnected",
            "messageType", "agent_message",
            "payload", Map.of("text", "Hello")
        );

        mockMvc.perform(post("/internal/send")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)))
            .andExpect(status().isServiceUnavailable());
    }
}
