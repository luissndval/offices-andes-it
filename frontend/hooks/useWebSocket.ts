'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ClientMessage, ServerMessage } from '../lib/protocol';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export function useWebSocket(url: string, onMessage: (msg: ServerMessage) => void) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        handlerRef.current(parsed);
      } catch {
        /* ignore invalid json */
      }
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('disconnected');

    return () => ws.close();
  }, [url]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return { status, send };
}
