'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useWebSocket } from '../hooks/useWebSocket';
import type {
  AgentDefinitionDTO,
  AgentState,
  AllowedToolLevel,
  ServerMessage,
} from '../lib/protocol';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://127.0.0.1:3001/ws';
const HTTP_BASE = WS_URL.replace(/^ws/, 'http').replace(/\/ws$/, '');

type ChatEntry =
  | { kind: 'user'; content: string; ts: number }
  | { kind: 'assistant'; content: string; ts: number }
  | { kind: 'tool_use'; tool: string; input: unknown; ts: number }
  | { kind: 'tool_result'; tool: string; output: string; isError: boolean; ts: number }
  | { kind: 'system'; content: string; ts: number };

export default function Page() {
  const [agents, setAgents] = useState<AgentDefinitionDTO[]>([]);
  const [agentId, setAgentId] = useState<string>('tech-lead');
  const [projectPath, setProjectPath] = useState<string>('');
  const [toolLevel, setToolLevel] = useState<AllowedToolLevel>('read_only');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<AgentState>('idle');
  const [chat, setChat] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'hello':
        return;
      case 'session_opened':
        setSessionId(msg.sessionId);
        setState('idle');
        setChat((prev) => [
          ...prev,
          {
            kind: 'system',
            content: `Sesión abierta con ${msg.agentId} en ${msg.cwd}`,
            ts: Date.now(),
          },
        ]);
        return;
      case 'session_closed':
        setSessionId(null);
        setState('idle');
        setChat((prev) => [
          ...prev,
          { kind: 'system', content: `Sesión cerrada (${msg.reason ?? 'unknown'})`, ts: Date.now() },
        ]);
        return;
      case 'agent_state':
        setState(msg.state);
        return;
      case 'message_chunk':
        setStreaming((prev) => prev + msg.delta);
        return;
      case 'message_complete':
        setChat((prev) => [
          ...prev,
          { kind: 'assistant', content: msg.text, ts: Date.now() },
        ]);
        setStreaming('');
        return;
      case 'tool_use':
        setChat((prev) => [
          ...prev,
          { kind: 'tool_use', tool: msg.tool, input: msg.input, ts: Date.now() },
        ]);
        return;
      case 'tool_result':
        setChat((prev) => [
          ...prev,
          {
            kind: 'tool_result',
            tool: '',
            output: msg.output,
            isError: Boolean(msg.isError),
            ts: Date.now(),
          },
        ]);
        return;
      case 'error':
        setChat((prev) => [
          ...prev,
          { kind: 'system', content: `error[${msg.code}]: ${msg.message}`, ts: Date.now() },
        ]);
        return;
    }
  }, []);

  const { status, send } = useWebSocket(WS_URL, handleMessage);

  useEffect(() => {
    fetch(`${HTTP_BASE}/agents`)
      .then((r) => r.json() as Promise<AgentDefinitionDTO[]>)
      .then(setAgents)
      .catch(() => {});
  }, []);

  const canOpenSession = status === 'connected' && !sessionId && projectPath.trim().length > 0;
  const canSend = sessionId !== null && input.trim().length > 0 && state !== 'thinking' && state !== 'tool_use';

  const openSession = useCallback(() => {
    send({
      type: 'open_session',
      agentId,
      projectPath: projectPath.trim(),
      toolLevel,
    });
  }, [send, agentId, projectPath, toolLevel]);

  const sendMessage = useCallback(() => {
    if (!sessionId || !input.trim()) return;
    setChat((prev) => [...prev, { kind: 'user', content: input, ts: Date.now() }]);
    send({ type: 'send_message', sessionId, content: input });
    setInput('');
  }, [send, sessionId, input]);

  const closeSession = useCallback(() => {
    if (!sessionId) return;
    send({ type: 'close_session', sessionId });
  }, [send, sessionId]);

  const currentAgent = useMemo(() => agents.find((a) => a.id === agentId), [agents, agentId]);

  return (
    <main style={{ display: 'flex', minHeight: '100dvh' }}>
      <aside
        style={{
          width: 320,
          padding: '1.5rem',
          borderRight: '1px solid #232634',
          background: '#0f121a',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Agent Workbench</h1>
          <div style={{ marginTop: 4, fontSize: '0.8rem', opacity: 0.6 }}>
            Fase 1 — un chat
          </div>
        </div>

        <StatusBadge status={status} />

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Agente</span>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            disabled={sessionId !== null}
            style={selectStyle}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
          {currentAgent && (
            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              {currentAgent.description}
            </span>
          )}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Carpeta de trabajo</span>
          <input
            type="text"
            placeholder="/home/user/proyecto"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            disabled={sessionId !== null}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Nivel de tools</span>
          <select
            value={toolLevel}
            onChange={(e) => setToolLevel(e.target.value as AllowedToolLevel)}
            disabled={sessionId !== null}
            style={selectStyle}
          >
            <option value="read_only">solo lectura (Read, Glob, Grep)</option>
            <option value="edit">edición (+ Edit, Write)</option>
            <option value="full">total (+ Bash, Web)</option>
          </select>
        </label>

        {sessionId ? (
          <button onClick={closeSession} style={dangerButtonStyle}>
            Cerrar sesión
          </button>
        ) : (
          <button
            onClick={openSession}
            disabled={!canOpenSession}
            style={{ ...primaryButtonStyle, opacity: canOpenSession ? 1 : 0.4 }}
          >
            Abrir chat
          </button>
        )}

        {sessionId && (
          <div style={{ fontSize: '0.7rem', opacity: 0.5, wordBreak: 'break-all' }}>
            sessionId: {sessionId}
            <br />
            estado: {state}
          </div>
        )}
      </aside>

      <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {chat.length === 0 && !streaming && (
            <div style={{ opacity: 0.4, textAlign: 'center', marginTop: '20vh' }}>
              Abrí un chat desde la barra lateral para empezar.
            </div>
          )}
          {chat.map((entry, i) => (
            <ChatBubble key={i} entry={entry} />
          ))}
          {streaming && (
            <div style={bubbleStyles.assistant}>
              <span style={{ opacity: 0.9 }}>{streaming}</span>
              <span style={{ opacity: 0.4, marginLeft: 4 }}>▊</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          style={{
            borderTop: '1px solid #232634',
            padding: '1rem',
            display: 'flex',
            gap: '0.5rem',
            background: '#0f121a',
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={sessionId ? 'Escribí un mensaje...' : 'Abrí una sesión primero'}
            disabled={!sessionId}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" disabled={!canSend} style={{ ...primaryButtonStyle, opacity: canSend ? 1 : 0.4 }}>
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'connected' ? '#7FE6A1' : status === 'connecting' ? '#FFD580' : '#FF8080';
  return (
    <div
      style={{
        fontSize: '0.75rem',
        padding: '4px 8px',
        border: `1px solid ${color}`,
        color,
        borderRadius: 4,
        display: 'inline-block',
        width: 'fit-content',
      }}
    >
      backend: {status}
    </div>
  );
}

function ChatBubble({ entry }: { entry: ChatEntry }) {
  if (entry.kind === 'user')
    return <div style={bubbleStyles.user}>{entry.content}</div>;
  if (entry.kind === 'assistant')
    return <div style={bubbleStyles.assistant}>{entry.content}</div>;
  if (entry.kind === 'system')
    return <div style={bubbleStyles.system}>— {entry.content}</div>;
  if (entry.kind === 'tool_use')
    return (
      <div style={bubbleStyles.tool}>
        🔧 <strong>{entry.tool}</strong>
        <pre style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>
          {JSON.stringify(entry.input, null, 2).slice(0, 400)}
        </pre>
      </div>
    );
  return (
    <div style={{ ...bubbleStyles.tool, borderColor: entry.isError ? '#FF8080' : '#3a4058' }}>
      <div style={{ opacity: 0.6, fontSize: '0.75rem' }}>
        {entry.isError ? 'error' : 'resultado'}
      </div>
      <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
        {entry.output.slice(0, 1000)}
      </pre>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#1a1f2e',
  color: '#e8e8f0',
  border: '1px solid #2a3046',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: '0.9rem',
  fontFamily: 'inherit',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const primaryButtonStyle: React.CSSProperties = {
  background: '#7F77DD',
  color: '#fff',
  border: 'none',
  padding: '10px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 600,
};

const dangerButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#FF8080',
  border: '1px solid #FF8080',
  padding: '10px 14px',
  borderRadius: 6,
  cursor: 'pointer',
};

const bubbleStyles: Record<string, React.CSSProperties> = {
  user: {
    alignSelf: 'flex-end',
    background: '#7F77DD',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 12,
    maxWidth: '70%',
    whiteSpace: 'pre-wrap',
  },
  assistant: {
    alignSelf: 'flex-start',
    background: '#1a1f2e',
    border: '1px solid #2a3046',
    padding: '8px 12px',
    borderRadius: 12,
    maxWidth: '70%',
    whiteSpace: 'pre-wrap',
  },
  system: {
    alignSelf: 'center',
    opacity: 0.5,
    fontSize: '0.75rem',
    fontStyle: 'italic',
  },
  tool: {
    alignSelf: 'flex-start',
    background: '#1a1f2e',
    border: '1px dashed #3a4058',
    padding: '8px 12px',
    borderRadius: 8,
    maxWidth: '80%',
    fontFamily: 'ui-monospace, monospace',
  },
};
