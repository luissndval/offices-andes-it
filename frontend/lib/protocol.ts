// NOTE: mirrored from backend/src/protocol.ts. Keep in sync manually until we
// extract a shared workspace package.

export type AllowedToolLevel = 'read_only' | 'edit' | 'full';

export type AgentState =
  | 'idle'
  | 'thinking'
  | 'typing_response'
  | 'tool_use'
  | 'error';

export type ClientMessage =
  | {
      type: 'open_session';
      agentId: string;
      projectPath: string;
      toolLevel?: AllowedToolLevel;
    }
  | { type: 'send_message'; sessionId: string; content: string }
  | { type: 'close_session'; sessionId: string };

export type ServerMessage =
  | { type: 'hello'; service: string; version: string }
  | { type: 'session_opened'; sessionId: string; agentId: string; cwd: string }
  | { type: 'session_closed'; sessionId: string; reason?: string }
  | { type: 'agent_state'; sessionId: string; state: AgentState }
  | { type: 'message_chunk'; sessionId: string; delta: string }
  | { type: 'message_complete'; sessionId: string; text: string; costUsd?: number }
  | {
      type: 'tool_use';
      sessionId: string;
      toolUseId: string;
      tool: string;
      input: unknown;
    }
  | {
      type: 'tool_result';
      sessionId: string;
      toolUseId: string;
      output: string;
      isError?: boolean;
    }
  | { type: 'error'; sessionId?: string; code: string; message: string };

export type AgentDefinitionDTO = {
  id: string;
  displayName: string;
  description: string;
  color: string;
  defaultToolLevel: AllowedToolLevel;
};
