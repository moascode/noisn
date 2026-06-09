import { useEffect, useRef, useCallback } from 'react';

export function useSessionSocket({ onMessage, onReady, onDisconnect }) {
  const ws = useRef(null);

  useEffect(() => {
    const brokerUrl = import.meta.env.VITE_BROKER_WS_URL || 'ws://localhost:3001';
    const socket = new WebSocket(`${brokerUrl}/ws`);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'start_session' }));
    };

    socket.onmessage = (event) => {
      const frame = JSON.parse(event.data);
      if (frame.type === 'session_ready') {
        onReady?.(frame.processInstanceKey);
      } else {
        onMessage?.(frame);
      }
    };

    socket.onclose = () => {
      onDisconnect?.();
    };

    socket.onerror = (e) => {
      console.error('WebSocket error', e);
    };

    ws.current = socket;
    return () => socket.close();
  }, []);

  const send = useCallback((content) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'user_message', content }));
    }
  }, []);

  const resume = useCallback((processInstanceKey) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type: 'resume_session', processInstanceKey }));
    }
  }, []);

  return { send, resume };
}
