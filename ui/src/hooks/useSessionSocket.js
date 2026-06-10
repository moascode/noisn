import { useEffect, useRef, useCallback } from 'react';

/**
 * Manages a WebSocket connection to the Session Broker.
 *
 * Callbacks are held in refs so socket event handlers always invoke the
 * latest version without needing to be in the effect dependency array
 * (which would cause the socket to be recreated on every render).
 *
 * @param {object} opts
 * @param {boolean} opts.enabled    - Connect only when true (e.g. after consent)
 * @param {function} opts.onMessage - Called with each typed frame from the broker
 * @param {function} opts.onReady   - Called with processInstanceKey when session starts
 * @param {function} opts.onDisconnect - Called when the socket closes
 */
export function useSessionSocket({ enabled, onMessage, onReady, onDisconnect }) {
  const wsRef = useRef(null);

  // Keep callback refs current on every render — no stale closure risk
  const onMessageRef = useRef(onMessage);
  const onReadyRef = useRef(onReady);
  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => {
    onMessageRef.current = onMessage;
    onReadyRef.current = onReady;
    onDisconnectRef.current = onDisconnect;
  });

  useEffect(() => {
    if (!enabled) return;

    const brokerUrl = import.meta.env.VITE_BROKER_WS_URL || 'ws://localhost:3001';
    const socket = new WebSocket(`${brokerUrl}/ws`);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'start_session' }));
    };

    socket.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        console.error('Received non-JSON WebSocket frame:', event.data);
        return;
      }
      if (frame.type === 'session_ready') {
        onReadyRef.current?.(frame.processInstanceKey);
      } else {
        onMessageRef.current?.(frame);
      }
    };

    socket.onclose = () => {
      onDisconnectRef.current?.();
    };

    socket.onerror = (e) => {
      console.error('WebSocket error', e);
    };

    wsRef.current = socket;
    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [enabled]);

  const send = useCallback((content) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'user_message', content }));
    }
  }, []);

  return { send };
}
