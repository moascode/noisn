package com.danica.broker.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.util.concurrent.ConcurrentHashMap;

@Component
public class SessionStore {

    public enum SessionState { ACTIVE, WAITING, COMPLETE, DISCONNECTED }

    public static class SessionEntry {
        public volatile WebSocketSession ws;
        public final String processInstanceKey;
        public volatile SessionState state;

        public SessionEntry(WebSocketSession ws, String processInstanceKey) {
            this.ws = ws;
            this.processInstanceKey = processInstanceKey;
            this.state = SessionState.ACTIVE;
        }
    }

    // sessionId → entry
    private final ConcurrentHashMap<String, SessionEntry> bySessionId = new ConcurrentHashMap<>();
    // processInstanceKey → sessionId (for reverse lookup from workers)
    private final ConcurrentHashMap<String, String> byProcessInstanceKey = new ConcurrentHashMap<>();

    public void register(String sessionId, WebSocketSession ws, String processInstanceKey) {
        SessionEntry entry = new SessionEntry(ws, processInstanceKey);
        bySessionId.put(sessionId, entry);
        byProcessInstanceKey.put(processInstanceKey, sessionId);
    }

    public SessionEntry getBySessionId(String sessionId) {
        return bySessionId.get(sessionId);
    }

    public SessionEntry getByProcessInstanceKey(String processInstanceKey) {
        String sessionId = byProcessInstanceKey.get(processInstanceKey);
        return sessionId != null ? bySessionId.get(sessionId) : null;
    }

    public void reAssociateWebSocket(String processInstanceKey, WebSocketSession newWs) {
        String sessionId = byProcessInstanceKey.get(processInstanceKey);
        if (sessionId != null) {
            SessionEntry entry = bySessionId.get(sessionId);
            if (entry != null) {
                entry.ws = newWs;
                entry.state = SessionState.ACTIVE;
            }
        }
    }

    public void markDisconnected(String sessionId) {
        SessionEntry entry = bySessionId.get(sessionId);
        if (entry != null) {
            entry.state = SessionState.DISCONNECTED;
        }
    }

    public void remove(String sessionId) {
        SessionEntry entry = bySessionId.remove(sessionId);
        if (entry != null) {
            byProcessInstanceKey.remove(entry.processInstanceKey);
        }
    }
}
