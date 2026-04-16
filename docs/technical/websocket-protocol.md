# WebSocket Protocol — Agent Workbench v1

**Reemplaza**: `ARCHITECTURE.md` v0 § 5.
**Referencias**: ADR-004 (terminal), ADR-005 (seguridad de path), ADR-006 (customización), ADR-007 (custom agents).

Todos los mensajes son JSON. Un solo WebSocket por cliente en `ws://127.0.0.1:3001/ws`. Los campos `sessionId`, `ptyId`, `agentId`, `toolUseId` son strings opacos (nanoid sugerido, 21 chars).

## 1. Constantes

```typescript
// shared/constants.ts
export const WS_PATH = "/ws";
export const WS_HEARTBEAT_MS = 20000;
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
export const PROTOCOL_VERSION = 1;
```

El cliente envía `hello` como primer mensaje con `PROTOCOL_VERSION`. Si el server tiene versión distinta, envía `error` con `code: "protocol_version_mismatch"` y cierra la conexión.

## 2. Tipos compartidos

```typescript
// shared/protocol.ts
export type SessionId = string;
export type PtyId = string;
export type AgentId = string;
export type ToolUseId = string;
export type MessageId = string;

export type AgentState =
  | "idle"
  | "thinking"
  | "typing_response"
  | "tool_use"
  | "waiting_approval"
  | "waiting_path_confirmation"
  | "error";

export type ToolStatus =
  | "pending_approval"
  | "executing"
  | "completed"
  | "rejected";

export type AgentDefinition = {
  id: AgentId;
  displayName: string;
  description: string;
  color: string;                       // #RRGGBB
  spriteVariant: string;
  model?: string;
  source: "builtin" | "custom";
  mdPath?: string;                     // solo builtin
  customDir?: string;                  // solo custom (ADR-007)
};

export type CharacterCustomization = {
  agentId: AgentId;
  displayName: string;
  colorHex: string;
  spriteVariant: string;
  updatedAt: string;                   // ISO 8601
};

export type ToolRequest = {
  toolUseId: ToolUseId;
  tool: string;                        // "Read" | "Write" | "Bash" | ...
  input: unknown;
};
```

## 3. Client → Server

```typescript
export type ClientMessage =
  | HelloMsg
  | OpenSessionMsg
  | ConfirmPathMsg
  | CloseSessionMsg
  | SendMessageMsg
  | ApproveToolMsg
  | RejectToolMsg
  // Pty (ADR-004)
  | PtyOpenMsg
  | PtyInputMsg
  | PtyResizeMsg
  | PtyCloseMsg
  // Customization (ADR-006)
  | GetCharactersMsg
  | UpdateCharacterMsg
  | ResetCharacterMsg
  // Agents registry (ADR-007)
  | GetAgentsMsg
  | Heartbeat;

export type HelloMsg = {
  type: "hello";
  protocolVersion: number;             // PROTOCOL_VERSION
};

export type OpenSessionMsg = {
  type: "open_session";
  agentId: AgentId;
  projectPath: string;                 // absoluto, ver ADR-005
};

export type ConfirmPathMsg = {
  type: "confirm_path";
  projectPath: string;
  accept: boolean;
};

export type CloseSessionMsg = {
  type: "close_session";
  sessionId: SessionId;
};

export type SendMessageMsg = {
  type: "send_message";
  sessionId: SessionId;
  content: string;
};

export type ApproveToolMsg = {
  type: "approve_tool";
  sessionId: SessionId;
  toolUseId: ToolUseId;
};

export type RejectToolMsg = {
  type: "reject_tool";
  sessionId: SessionId;
  toolUseId: ToolUseId;
  reason?: string;
};

export type PtyOpenMsg = {
  type: "pty_open";
  sessionId: SessionId;                // asociada (ADR-004)
  cols: number;                        // PTY_DEFAULT_COLS si omitido en UI
  rows: number;
};

export type PtyInputMsg = {
  type: "pty_input";
  ptyId: PtyId;
  dataBase64: string;                  // bytes, max PTY_INPUT_MAX_BYTES decoded
};

export type PtyResizeMsg = {
  type: "pty_resize";
  ptyId: PtyId;
  cols: number;
  rows: number;
};

export type PtyCloseMsg = {
  type: "pty_close";
  ptyId: PtyId;
};

export type GetCharactersMsg = { type: "get_characters" };

export type UpdateCharacterMsg = {
  type: "update_character";
  agentId: AgentId;
  patch: Partial<Pick<CharacterCustomization, "displayName" | "colorHex" | "spriteVariant">>;
};

export type ResetCharacterMsg = {
  type: "reset_character";
  agentId: AgentId;
};

export type GetAgentsMsg = { type: "get_agents" };

export type Heartbeat = { type: "heartbeat" };
```

## 4. Server → Client

```typescript
export type ServerMessage =
  | HelloAckMsg
  | SessionOpenedMsg
  | SessionClosedMsg
  | PathRequiresConfirmationMsg
  | MessageChunkMsg
  | MessageCompleteMsg
  | ToolRequestMsg
  | ToolResultMsg
  | AgentStateMsg
  | ErrorMsg
  // Pty
  | PtyOpenedMsg
  | PtyOutputMsg
  | PtyExitMsg
  // Customization
  | CharactersMsg
  | CharacterUpdatedMsg
  // Agents
  | AgentsUpdatedMsg
  | HeartbeatAck;

export type HelloAckMsg = {
  type: "hello_ack";
  protocolVersion: number;
  serverVersion: string;
};

export type SessionOpenedMsg = {
  type: "session_opened";
  sessionId: SessionId;
  agentId: AgentId;
  projectPath: string;
};

export type SessionClosedMsg = {
  type: "session_closed";
  sessionId: SessionId;
  reason: "user" | "timeout" | "crash" | "kill";
};

export type PathRequiresConfirmationMsg = {
  type: "path_requires_confirmation";
  projectPath: string;
  reason: "outside_home" | "contains_parent_ref" | "shallow_depth";
  message: string;                     // human-readable
};

export type MessageChunkMsg = {
  type: "message_chunk";
  sessionId: SessionId;
  messageId: MessageId;
  delta: string;
};

export type MessageCompleteMsg = {
  type: "message_complete";
  sessionId: SessionId;
  messageId: MessageId;
};

export type ToolRequestMsg = {
  type: "tool_request";
  sessionId: SessionId;
  toolUseId: ToolUseId;
  tool: string;
  input: unknown;
};

export type ToolResultMsg = {
  type: "tool_result";
  sessionId: SessionId;
  toolUseId: ToolUseId;
  status: ToolStatus;
  output?: string;                     // stdout/result
  error?: string;                      // si status === "rejected" o falló
};

export type AgentStateMsg = {
  type: "agent_state";
  sessionId: SessionId;
  state: AgentState;
};

export type ErrorMsg = {
  type: "error";
  sessionId?: SessionId;
  ptyId?: PtyId;
  code: ErrorCode;
  message: string;
};

export type ErrorCode =
  | "protocol_version_mismatch"
  | "invalid_message"
  | "session_not_found"
  | "session_limit_reached"
  | "path_blocked"
  | "path_not_found"
  | "agent_not_found"
  | "pty_spawn_failed"
  | "pty_not_found"
  | "subprocess_spawn_failed"
  | "internal_error";

export type PtyOpenedMsg = {
  type: "pty_opened";
  ptyId: PtyId;
  sessionId: SessionId;
  cols: number;
  rows: number;
};

export type PtyOutputMsg = {
  type: "pty_output";
  ptyId: PtyId;
  dataBase64: string;                  // chunk <= PTY_OUTPUT_CHUNK_MAX_BYTES
};

export type PtyExitMsg = {
  type: "pty_exit";
  ptyId: PtyId;
  exitCode: number | null;
  signal?: string;
};

export type CharactersMsg = {
  type: "characters";
  byAgentId: Record<AgentId, CharacterCustomization>;
  schemaVersion: number;
};

export type CharacterUpdatedMsg = {
  type: "character_updated";
  agentId: AgentId;
  character: CharacterCustomization;
};

export type AgentsUpdatedMsg = {
  type: "agents_updated";
  agents: AgentDefinition[];
  builtinCount: number;
  customCount: number;
};

export type HeartbeatAck = { type: "heartbeat_ack" };
```

## 5. Flujo de ejemplo: abrir chat + terminal Bash

```
C → S : { type: "hello", protocolVersion: 1 }
S → C : { type: "hello_ack", protocolVersion: 1, serverVersion: "0.1.0" }

C → S : { type: "get_agents" }
S → C : { type: "agents_updated", agents: [...], builtinCount: 8, customCount: 2 }

C → S : { type: "get_characters" }
S → C : { type: "characters", byAgentId: {...}, schemaVersion: 1 }

C → S : { type: "open_session", agentId: "tech-lead", projectPath: "/home/u/proj" }
S → C : { type: "path_requires_confirmation", projectPath: "/opt/proj", reason: "outside_home", message: "..." }
C → S : { type: "confirm_path", projectPath: "/opt/proj", accept: true }
S → C : { type: "session_opened", sessionId: "abc", agentId: "tech-lead", projectPath: "/opt/proj" }
S → C : { type: "agent_state", sessionId: "abc", state: "idle" }

C → S : { type: "send_message", sessionId: "abc", content: "Contame la arquitectura" }
S → C : { type: "agent_state", sessionId: "abc", state: "thinking" }
S → C : { type: "message_chunk", sessionId: "abc", messageId: "m1", delta: "Voy a " }
S → C : { type: "tool_request", sessionId: "abc", toolUseId: "t1", tool: "Read", input: {...} }
S → C : { type: "agent_state", sessionId: "abc", state: "waiting_approval" }
C → S : { type: "approve_tool", sessionId: "abc", toolUseId: "t1" }
S → C : { type: "tool_result", sessionId: "abc", toolUseId: "t1", status: "completed", output: "..." }
S → C : { type: "message_chunk", sessionId: "abc", messageId: "m1", delta: "Basado en..." }
S → C : { type: "message_complete", sessionId: "abc", messageId: "m1" }
S → C : { type: "agent_state", sessionId: "abc", state: "idle" }

C → S : { type: "pty_open", sessionId: "abc", cols: 120, rows: 30 }
S → C : { type: "pty_opened", ptyId: "p1", sessionId: "abc", cols: 120, rows: 30 }
C → S : { type: "pty_input", ptyId: "p1", dataBase64: "<base64('ls -la\r')>" }
S → C : { type: "pty_output", ptyId: "p1", dataBase64: "<base64('total 42\n...')>" }
```

## 6. Garantías y reglas

- **Orden**: para una misma `sessionId`, los mensajes llegan en orden FIFO. No hay guarantee cross-session.
- **Idempotencia**: `close_session` y `pty_close` son idempotentes. Llamadas duplicadas retornan el mismo final state sin error.
- **Aprobaciones**: un `toolUseId` debe aprobarse/rechazarse **exactamente una vez**. Duplicados → `error` con `invalid_message`.
- **Reconnect**: al perder WS, el cliente reintenta con backoff `WS_RECONNECT_BASE_MS → WS_RECONNECT_MAX_MS`. Al reconectar, el server mantiene las sesiones vivas hasta `SESSION_IDLE_TIMEOUT_MS` y el cliente puede hacer `get_agents` + `get_characters` para rehidratar. Los mensajes perdidos durante la desconexión **no se reenvían** (decisión simplificadora — ver `open-questions.md`).
- **Heartbeat**: client envía `heartbeat` cada `WS_HEARTBEAT_MS`; server responde `heartbeat_ack`. 2 fallos consecutivos → cerrar socket y reconectar.
- **Pty independence**: cerrar sesión de agente cierra sus pty asociadas. Cerrar pty no cierra la sesión.

## 7. Codificación de binarios

- `dataBase64` siempre es base64 estándar (no URL-safe).
- El cliente decodifica con `atob` o `Uint8Array.from(atob(s), c => c.charCodeAt(0))`.
- El backend usa `Buffer.from(str, "base64")` y `buffer.toString("base64")`.

## 8. Versionado

- `PROTOCOL_VERSION` entero monotónico. Breaking changes suben versión.
- La negociación es `hello`/`hello_ack`. Cliente puede mostrar UI de "actualiza la app" si mismatch.

## 9. Diferencias vs v0

- Se agregan: `hello`, `hello_ack`, `path_requires_confirmation`, `confirm_path`, `pty_*`, `get_characters`, `update_character`, `character_updated`, `get_agents`, `agents_updated`, `heartbeat*`.
- `error` ahora lleva `code` tipado (antes era mensaje suelto).
- `session_closed` ahora lleva `reason`.
- `message_chunk` ahora incluye `messageId` explícito (necesario para alinear con `message_complete` si hay múltiples respuestas encadenadas).
- `tool_result` ahora lleva `status` (antes se asumía completed).
