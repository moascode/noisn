package com.danica.broker.ws;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionStore {

    private static final Logger log = LoggerFactory.getLogger(SessionStore.class);

    public enum SessionState { ACTIVE, WAITING, COMPLETE, DISCONNECTED }

    public static class SessionEntry {
        private volatile WebSocketSession ws;
        private final String processInstanceKey;
        private final String sessionId;
        private volatile SessionState state;
        private volatile Instant disconnectedAt;

        public SessionEntry(WebSocketSession ws, String processInstanceKey, String sessionId) {
            this.ws = ws;
            this.processInstanceKey = processInstanceKey;
            this.sessionId = sessionId;
            this.state = SessionState.ACTIVE;
        }

        public WebSocketSession getWs() { return ws; }
        public void setWs(WebSocketSession ws) { this.ws = ws; }
        public String getProcessInstanceKey() { return processInstanceKey; }
        public String getSessionId() { return sessionId; }
        public SessionState getState() { return state; }
        public void setState(SessionState state) { this.state = state; }
        public Instant getDisconnectedAt() { return disconnectedAt; }
        public void setDisconnectedAt(Instant t) { this.disconnectedAt = t; }
    }

    // sessionId → entry
    private final ConcurrentHashMap<String, SessionEntry> bySessionId = new ConcurrentHashMap<>();
    // processInstanceKey → sessionId (reverse lookup used by workers via /internal/send)
    private final ConcurrentHashMap<String, String> byProcessInstanceKey = new ConcurrentHashMap<>();

    // Guards compound updates to both maps so reads never see partial state
    private final Object registrationLock = new Object();

    @Value("${broker.session-disconnect-ttl-minutes:30}")
    private long disconnectTtlMinutes;

    public void register(String sessionId, WebSocketSession ws, String processInstanceKey) {
        SessionEntry entry = new SessionEntry(ws, processInstanceKey, sessionId);
        synchronized (registrationLock) {
            bySessionId.put(sessionId, entry);
            byProcessInstanceKey.put(processInstanceKey, sessionId);
        }
    }

    public SessionEntry getBySessionId(String sessionId) {
        return bySessionId.get(sessionId);
    }

    public SessionEntry getByProcessInstanceKey(String processInstanceKey) {
        String sessionId = byProcessInstanceKey.get(processInstanceKey);
        return sessionId != null ? bySessionId.get(sessionId) : null;
    }

    /**
     * Re-associates an existing process instance entry with a new WebSocket connection
     * (called on resume_session). Returns the old sessionId so the new socket can adopt it.
     */
    public String reAssociateWebSocket(String processInstanceKey, WebSocketSession newWs) {
        String oldSessionId = byProcessInstanceKey.get(processInstanceKey);
        if (oldSessionId != null) {
            SessionEntry entry = bySessionId.get(oldSessionId);
            if (entry != null) {
                entry.setWs(newWs);
                entry.setState(SessionState.ACTIVE);
                entry.setDisconnectedAt(null);
            }
        }
        return oldSessionId;
    }

    public void markDisconnected(String sessionId) {
        SessionEntry entry = bySessionId.get(sessionId);
        if (entry != null) {
            entry.setState(SessionState.DISCONNECTED);
            entry.setDisconnectedAt(Instant.now());
        }
    }

    public void remove(String sessionId) {
        synchronized (registrationLock) {
            SessionEntry entry = bySessionId.remove(sessionId);
            if (entry != null) {
                byProcessInstanceKey.remove(entry.getProcessInstanceKey());
            }
        }
    }

    /** Evict entries that have been DISCONNECTED longer than the configured TTL. */
    @Scheduled(fixedRateString = "PT5M")
    public void evictExpiredSessions() {
        Instant cutoff = Instant.now().minusSeconds(disconnectTtlMinutes * 60);
        bySessionId.forEach((sessionId, entry) -> {
            if (entry.getState() == SessionState.DISCONNECTED
                    && entry.getDisconnectedAt() != null
                    && entry.getDisconnectedAt().isBefore(cutoff)) {
                remove(sessionId);
                log.info("Evicted expired session: sessionId={}, processInstanceKey={}",
                    sessionId, entry.getProcessInstanceKey());
            }
        });
    }
}
