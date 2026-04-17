import { existsSync, statSync } from 'node:fs';

import { getAgent } from '../config/loadAgents.js';
import type { AllowedToolLevel, ServerMessage } from '../protocol.js';
import { AgentSession } from './AgentSession.js';

const MAX_SESSIONS_SOFT_LIMIT = 10;

export class SessionManager {
  private sessions = new Map<string, AgentSession>();

  get size(): number {
    return this.sessions.size;
  }

  openSession(params: {
    agentId: string;
    projectPath: string;
    toolLevel?: AllowedToolLevel;
    emit: (msg: ServerMessage) => void;
  }): { ok: true; sessionId: string } | { ok: false; error: ServerMessage } {
    if (this.sessions.size >= MAX_SESSIONS_SOFT_LIMIT) {
      return {
        ok: false,
        error: {
          type: 'error',
          code: 'session_limit',
          message: `Maximum ${MAX_SESSIONS_SOFT_LIMIT} concurrent sessions. Close one first.`,
        },
      };
    }

    const agent = getAgent(params.agentId);
    if (!agent) {
      return {
        ok: false,
        error: {
          type: 'error',
          code: 'unknown_agent',
          message: `Agent not found: ${params.agentId}`,
        },
      };
    }

    const resolved = params.projectPath;
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      return {
        ok: false,
        error: {
          type: 'error',
          code: 'invalid_project_path',
          message: `Project path does not exist or is not a directory: ${resolved}`,
        },
      };
    }

    const session = new AgentSession({
      agent,
      projectPath: resolved,
      toolLevel: params.toolLevel ?? agent.defaultToolLevel,
      onMessage: params.emit,
      onExit: () => {
        this.sessions.delete(session.sessionId);
      },
    });

    this.sessions.set(session.sessionId, session);
    session.start();
    return { ok: true, sessionId: session.sessionId };
  }

  sendMessage(sessionId: string, content: string): ServerMessage | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        type: 'error',
        sessionId,
        code: 'unknown_session',
        message: `Session not found: ${sessionId}`,
      };
    }
    session.sendUserMessage(content);
    return null;
  }

  async closeSession(sessionId: string, reason?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await session.close(reason);
    this.sessions.delete(sessionId);
  }

  async closeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.sessions.values()).map((s) => s.close('server_shutdown')),
    );
    this.sessions.clear();
  }
}
