# Architecture Overview — Agent Workbench (v1)

**Estado**: Propuesto
**Fecha**: 2026-04-16
**Reemplaza secciones de**: `ARCHITECTURE.md` v0 (§ 3 stack, § 4 carpetas, § 5 protocolo, § 7 estado, § 9 layout, § 12 seguridad)

Este documento es la **fuente de verdad actualizada** para arquitectura. `ARCHITECTURE.md` v0 queda como referencia histórica; donde haya conflicto, gana este documento + los ADR referenciados.

## 1. Cambios clave vs ARCHITECTURE.md v0

| Tema | v0 (original) | v1 (este doc) | ADR |
|---|---|---|---|
| Base | Build from scratch | Fork/copy de `pablodelucca/pixel-agents` | ADR-001 |
| Renderer | PixiJS v8 | Canvas 2D | ADR-002 |
| Estrategia fork | N/A | Copia MIT con atribución | ADR-003 |
| UI layout | Landing + ventanas draggable | Full-screen tipo juego con HUD | este doc § 3 |
| `projectPath` | Global en `config/projects.json` | Por chat, picker libre | ADR-005 |
| Terminal embebida | No existía | xterm.js + node-pty, 2 tabs | ADR-004 |
| Customización NPC | No existía | Nombre/color/sprite por agente, persistido | ADR-006 |
| Custom agents | Fijos en código | Drop-in `~/.agent-workbench/agents/` | ADR-007 |
| Seguridad de paths | Whitelist global | Denylist + warnlist + confirmación | ADR-005 |

## 2. Componentes (diagrama)

```
+---------------------------------------------------------------+
|                        Browser (React)                        |
|                                                               |
|  +----------------+    +----------------+    +-------------+  |
|  |  WorldCanvas   |    |   ChatDock     |    |   AgentDock |  |
|  |  (Canvas 2D)   |<---|  (windows)     |<---|  (sidebar)  |  |
|  |  - map         |    |  - messages    |    |             |  |
|  |  - NPCs        |    |  - tools       |    |             |  |
|  |  - bubbles     |    |  - terminal    |    |             |  |
|  +----------------+    +----------------+    +-------------+  |
|         ^                     ^                      ^        |
|         |                     |                      |        |
|         +---------------------+----------------------+        |
|                               |                               |
|              +----------------v----------------+              |
|              |  Zustand stores                 |              |
|              |  - sessions                     |              |
|              |  - map                          |              |
|              |  - characters (customization)   |              |
|              |  - agents (registry)            |              |
|              +----------------+----------------+              |
|                               |                               |
|              +----------------v----------------+              |
|              |  WebSocket client               |              |
|              +----------------+----------------+              |
+-------------------------------|-------------------------------+
                                |  JSON (one socket per user)
+-------------------------------v-------------------------------+
|                     Backend (Node.js + Fastify)               |
|                                                               |
|   +---------------+   +---------------+   +---------------+   |
|   | SessionMgr    |   | PtyManager    |   | AgentLoader   |   |
|   | (Map<id,Sess>)|   | (Map<id,pty>) |   | builtin+cust  |   |
|   +------+--------+   +------+--------+   +------+--------+   |
|          |                   |                   |            |
|          |                   |                   |            |
|   +------v--------+   +------v--------+   +------v--------+   |
|   | AgentSession  |   | node-pty      |   | CharStore     |   |
|   | (Claude Code  |   | (shell)       |   | (JSON file)   |   |
|   |  subprocess)  |   |               |   |               |   |
|   +------+--------+   +---------------+   +---------------+   |
|          |                                                    |
|          | stdin/stdout (stream-json)                         |
+----------|----------------------------------------------------+
           |
           v
   +----------------+
   | claude-code    |
   | CLI (headless) |
   +----------------+
```

## 3. UI full-screen

- **No hay landing**. Al arrancar, se muestra directamente el canvas a pantalla completa con la oficina vacía y el dock de agentes.
- **HUD superpuesto**:
  - Barra lateral izquierda (`AgentDock`): lista de agentes disponibles (builtin + custom).
  - Barra inferior: status (conexión WS, sesiones activas, warnings).
  - Ventanas de chat: overlay con z-index sobre el canvas, draggable y redimensionables, con tabs (Mensajes / Agente terminal / Bash).
- **Cámara**: fija para MVP. No hay pan ni zoom.
- **Focus de ventana**: ventana activa en z-index top; el canvas sigue activo (animaciones de NPCs no pausan).

## 4. Stack actualizado

### Frontend
- **Framework**: Next.js 15 (App Router) + TypeScript (heredado).
- **Renderer 2D**: Canvas 2D (ADR-002).
- **Terminal**: xterm.js + addons (fit, web-links).
- **Estado**: Zustand (+ persist middleware para window layout).
- **UI**: shadcn/ui + Tailwind.
- **WebSocket**: cliente nativo del browser.

### Backend
- **Runtime**: Node.js 22+ (ESM).
- **HTTP/WS**: Fastify + `@fastify/websocket`.
- **Proceso manager**: `execa` o `node:child_process` (tbd en spike SPIKE-02).
- **Pty**: `node-pty`.
- **Watcher**: `chokidar` (para custom agents).
- **Validación**: `zod`.
- **Logging**: `pino`.

### Shared
- `shared/protocol.ts`: tipos de mensajes WS (ver `websocket-protocol.md`).
- `shared/constants.ts`: constantes con nombres (NO magic numbers).

## 5. Estructura de carpetas (v1)

```
agent-workbench/
├── NOTICE.md                          # atribución MIT a pixel-agents (ADR-003)
├── README.md
├── ARCHITECTURE.md                    # v0 histórico
├── docs/
│   ├── technical/
│   │   ├── architecture-overview.md   # ESTE archivo (v1)
│   │   ├── websocket-protocol.md
│   │   ├── session-lifecycle.md
│   │   ├── terminal-integration.md
│   │   ├── character-customization.md
│   │   ├── risks-and-spikes.md
│   │   ├── open-questions.md
│   │   └── adr/
│   │       ├── ADR-001-...md
│   │       ├── ADR-002-...md
│   │       └── ADR-007-...md
│   └── functional/
│       └── ...
├── package.json
├── pnpm-workspace.yaml
├── shared/
│   ├── protocol.ts
│   ├── constants.ts
│   └── types.ts
├── frontend/
│   ├── components/
│   │   ├── WorldCanvas.tsx            # Canvas 2D (portado de pixel-agents)
│   │   ├── HUD.tsx
│   │   ├── AgentDock.tsx
│   │   ├── ChatWindow.tsx             # tabs: messages, agent-terminal, bash
│   │   ├── Terminal.tsx               # xterm.js wrapper
│   │   ├── CharacterEditor.tsx        # modal de customización
│   │   └── NPCOverlay.tsx
│   ├── hooks/
│   │   ├── useWebSocket.ts
│   │   ├── useAgentSessions.ts
│   │   ├── useCharacters.ts
│   │   ├── useTerminal.ts
│   │   └── useCustomAgents.ts
│   ├── lib/
│   │   ├── agents/                    # registry builtin
│   │   ├── canvas/                    # código portado de pixel-agents
│   │   │   └── (con header de atribución — ADR-003)
│   │   └── sprites/
│   └── public/sprites/
├── backend/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── sessions/
│   │   │   ├── SessionManager.ts
│   │   │   ├── AgentSession.ts
│   │   │   └── streamParser.ts
│   │   ├── pty/
│   │   │   └── PtyManager.ts
│   │   ├── agents/
│   │   │   ├── builtinRegistry.ts
│   │   │   ├── CustomAgentLoader.ts
│   │   │   └── customAgentSchema.ts
│   │   ├── characters/
│   │   │   └── CharacterStore.ts
│   │   ├── security/
│   │   │   └── pathGuard.ts
│   │   └── config/
│   └── tests/
└── .env.example
```

## 6. Flujos principales (actualizados)

### 6.1 Abrir chat con folder picker

1. Usuario click en un agente del `AgentDock` → modal con folder picker (File System Access API si disponible, fallback a input nativo).
2. Frontend envía `{ type: "open_session", agentId, projectPath }`.
3. Backend valida `projectPath` (ADR-005). Si requiere confirmación → responde `path_requires_confirmation`.
4. Usuario confirma → envía `{ type: "confirm_path", projectPath }`.
5. Backend spawnea `claude` subprocess, crea `AgentSession`, responde `session_opened`.
6. Frontend monta NPC en el mapa + abre `ChatWindow` con 3 tabs.

### 6.2 Abrir terminal interactiva (tab Bash)

1. Usuario click en tab `Bash` de una `ChatWindow`.
2. Si la pty de esa sesión no existe: frontend envía `{ type: "pty_open", sessionId, cols, rows }`.
3. Backend crea `node-pty` con `cwd = session.projectPath`, env filtrado.
4. Backend responde `pty_opened` con `ptyId`.
5. xterm.js ↔ pty streaming vía `pty_input` / `pty_output` (ADR-004).

### 6.3 Observer terminal (tab Agente)

1. Tab read-only que renderiza los `tool_request` / `tool_result` del stream-json de Claude Code en formato terminal-like (prompt + comando + output).
2. **No hay pty nueva**. Es una vista derivada del stream existente.

### 6.4 Customización de personaje

1. Usuario click en NPC → modal `CharacterEditor`.
2. Cambios → `{ type: "update_character", agentId, patch }`.
3. Backend valida, escribe `characters.json` atómicamente, broadcast `character_updated`.
4. Todos los clientes (en este caso 1) actualizan Zustand store → canvas re-renderiza.

### 6.5 Agregar custom agent (drop-in)

1. Usuario crea carpeta `~/.agent-workbench/agents/<id>/` con `agent.yaml`, `prompt.md`, `sprite.png`.
2. `CustomAgentLoader` (chokidar) detecta cambio, valida, emite `agents_updated`.
3. Frontend refresca `AgentDock`, el nuevo agente aparece listo para abrir chat.

## 7. Modelo de datos

### Backend — en memoria

```typescript
class SessionManager {
  sessions: Map<SessionId, AgentSession>;  // SESSION_MAX_CONCURRENT = 10
}

class AgentSession {
  id: SessionId;
  agentId: AgentId;
  projectPath: string;                     // congelado al open
  process: ChildProcess;                   // claude CLI
  state: AgentState;
  createdAt: number;
  lastActivityAt: number;
  pendingApprovals: Map<ToolUseId, ToolRequest>;
}

class PtyManager {
  ptys: Map<PtyId, PtySession>;
}

class PtySession {
  id: PtyId;
  sessionId: SessionId;                    // FK a AgentSession
  pty: IPty;                               // node-pty
  cols: number;
  rows: number;
}
```

### Frontend — Zustand

```typescript
type SessionState = {
  sessionId: SessionId;
  agentId: AgentId;
  agentDisplayName: string;                // con customización aplicada
  projectPath: string;
  state: AgentState;
  messages: Message[];
  pendingToolRequest?: ToolRequest;
  windowPosition: { x: number; y: number };
  windowSize: { w: number; h: number };
  activeTab: "messages" | "agent-terminal" | "bash";
  ptyId?: PtyId;                           // si tab Bash abierta
};

type CharacterState = {
  byAgentId: Record<AgentId, CharacterCustomization>;
};
```

## 8. Constantes (sin magic numbers)

Todas viven en `shared/constants.ts`. Ejemplos:

```typescript
// Sesiones
export const SESSION_MAX_CONCURRENT = 10;
export const SESSION_SPAWN_TIMEOUT_MS = 15000;
export const SESSION_IDLE_TIMEOUT_MS = 3600000;
export const SESSION_KILL_GRACE_MS = 5000;

// Pty
export const PTY_DEFAULT_COLS = 120;
export const PTY_DEFAULT_ROWS = 30;
export const PTY_INPUT_MAX_BYTES = 8192;
export const PTY_OUTPUT_CHUNK_MAX_BYTES = 16384;
export const PTY_LATENCY_WARN_MS = 100;

// Character
export const CHARACTER_NAME_MAX_LEN = 32;
export const CHARACTER_NAME_MIN_LEN = 1;
export const CHARACTER_COLOR_HEX_LEN = 7;
export const CHARACTER_CUSTOMIZATION_SCHEMA_VERSION = 1;

// Custom agents
export const CUSTOM_AGENT_SPRITE_MAX_BYTES = 524288;
export const CUSTOM_AGENT_PROMPT_MAX_BYTES = 65536;
export const CUSTOM_AGENT_SCAN_INTERVAL_MS = 5000;
export const CUSTOM_AGENT_ID_REGEX = /^[a-z0-9-]{2,32}$/;

// WebSocket
export const WS_RECONNECT_BASE_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;
export const WS_HEARTBEAT_MS = 20000;

// Paths
export const PATH_MAX_DEPTH_SCAN = 6;
```

## 9. Referencias cruzadas

- Protocolo completo: `websocket-protocol.md`
- Ciclo de vida: `session-lifecycle.md`
- Terminal: `terminal-integration.md`
- Customización: `character-customization.md`
- Riesgos + spikes: `risks-and-spikes.md`
- Preguntas abiertas: `open-questions.md`
- ADRs: `adr/ADR-00*.md`
