'use client';

import { useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://127.0.0.1:3001/ws';

type Status = 'connecting' | 'connected' | 'disconnected' | 'error';

export default function Page() {
  const [status, setStatus] = useState<Status>('connecting');
  const [lastEvent, setLastEvent] = useState<string>('');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      ws.send(JSON.stringify({ type: 'ping' }));
    };
    ws.onmessage = (event) => {
      setLastEvent(event.data);
    };
    ws.onerror = () => setStatus('error');
    ws.onclose = () => setStatus('disconnected');

    return () => ws.close();
  }, []);

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '3rem',
        minHeight: '100dvh',
      }}
    >
      <h1 style={{ margin: 0 }}>Agent Workbench</h1>
      <p style={{ opacity: 0.7, margin: 0 }}>
        Fase 0 — smoke test de conectividad WebSocket frontend ↔ backend.
      </p>
      <section
        style={{
          border: '1px solid #232634',
          padding: '1rem',
          borderRadius: 8,
          background: '#111521',
        }}
      >
        <div>
          <strong>WS URL:</strong> <code>{WS_URL}</code>
        </div>
        <div>
          <strong>Estado:</strong>{' '}
          <span
            style={{
              color:
                status === 'connected'
                  ? '#7FE6A1'
                  : status === 'connecting'
                    ? '#FFD580'
                    : '#FF8080',
            }}
          >
            {status}
          </span>
        </div>
        <div>
          <strong>Último mensaje:</strong>{' '}
          <code style={{ wordBreak: 'break-all' }}>{lastEvent || '—'}</code>
        </div>
      </section>
    </main>
  );
}
