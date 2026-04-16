# Agent Workbench — Documento de Arquitectura

> Este documento es la **fuente de verdad** para implementar el proyecto. Claude Code debe leerlo completo antes de escribir código, y consultarlo cada vez que haya una duda de alcance o diseño.

---

## 1. Resumen ejecutivo

Agent Workbench es una app web local que visualiza agentes de desarrollo como NPCs en un mapa 2D tipo Gather, y expone un chat multi-ventana donde cada conversación abierta ejecuta un proceso real de Claude Code sobre un proyecto del filesystem.

**No es:**
- Un reemplazo de Claude Code (lo usa por debajo).
- Una app multi-usuario (es estrictamente local, single user).
- Una plataforma para distribuir (es uso personal).

**Es:**
- Un frontend visual + conversacional para Claude Code.
- Un experimento de UX para interactuar con múltiples agentes en paralelo.
- Una alternativa a tener N terminales abiertas.

## 2. Premisa central

**Cantidad de chats abiertos = cantidad de NPCs en el mapa**.

- El usuario abre un chat con "Tech Lead" → aparece el NPC Tech Lead en su escritorio.
- Abre otro con "Dev Backend" → aparece otro NPC.
- Cierra el chat del Tech Lead → el NPC desaparece del mapa.
- Cada chat abierto consume un proceso Claude Code dedicado con el system prompt del agente correspondiente.

## 3. Stack tecnológico

### Frontend
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Renderer 2D**: PixiJS v8 (mismo que Claude Office, sprites compatibles)
- **Estado global**: Zustand
- **Componentes UI**: shadcn/ui + Tailwind CSS
- **Comunicación con backend**: WebSocket nativo del browser

### Backend
- **Runtime**: Node.js 22+ (tipo module)
- **Framework HTTP**: Fastify
- **WebSocket**: @fastify/websocket
- **Proceso manager**: execa (para lanzar Claude Code con streaming)
- **Parseo de streams**: readline nativo + JSON.parse

### Ejecutor
- **Claude Code CLI** en modo headless: `claude --print --output-format stream-json --input-format stream-json`
- **Autenticación**: la suscripción Max existente del usuario (sin API keys adicionales)
- **System prompts**: los archivos `.md` de `.claude/agents/` del proyecto target

### Tooling
- **Monorepo**: pnpm workspaces (frontend/ + backend/ separados)
- **Linter**: eslint + prettier
- **Testing**: vitest (unit), playwright (e2e — opcional en MVP)
- **Dev server orchestration**: un solo `pnpm dev` arranca frontend + backend en paralelo con concurrently

## 4. Arquitectura de carpetas

```
agent-workbench/
├── package.json                     # Monorepo root con scripts de orchestration
├── pnpm-workspace.yaml
├── .env.example
├── .gitignore
├── README.md
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx              # Root con tema oscuro + fuente pixel
│   │   ├── page.tsx                # La única página (single page app)
│   │   └── globals.css
│   ├── components/
│   │   ├── WorldCanvas.tsx         # Mapa PixiJS, maneja NPCs y animaciones
│   │   ├── AgentDock.tsx           # Barra inferior con botones [+ Tech Lead] etc
│   │   ├── ChatWindow.tsx          # Ventana de chat individual (draggable)
│   │   ├── ChatContainer.tsx       # Contenedor de todas las ventanas
│   │   ├── NPC.tsx                 # Componente PixiJS de un personaje
│   │   └── MessageList.tsx         # Lista de mensajes + tool calls renderizados
│   ├── hooks/
│   │   ├── useWebSocket.ts         # Conexión WS al backend
│   │   ├── useAgentSessions.ts     # Estado Zustand: chats activos
│   │   └── useMapState.ts          # Estado del mapa (posición NPCs)
│   ├── lib/
│   │   ├── agents.ts               # Registry de agentes disponibles
│   │   ├── types.ts                # Tipos compartidos con backend
│   │   └── sprites.ts              # Carga de sprites pixel art
│   └── public/
│       └── sprites/                # PNGs de personajes y tiles de mapa
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts               # Fastify + WS setup
│   │   ├── routes/
│   │   │   ├── health.ts
│   │   │   ├── agents.ts           # GET /agents — lista agentes disponibles
│   │   │   └── projects.ts         # GET /projects — proyectos configurados
│   │   ├── sessions/
│   │   │   ├── SessionManager.ts   # Crea/destruye sesiones
│   │   │   ├── AgentSession.ts     # Wrapper de un proceso Claude Code
│   │   │   └── streamParser.ts     # Parsea stream-json de Claude Code
│   │   ├── config/
│   │   │   ├── loadAgents.ts       # Lee .claude/agents/*.md del proyecto
│   │   │   └── loadProjects.ts     # Lee config de proyectos soportados
│   │   └── types.ts                # Tipos compartidos con frontend
│   └── tests/
│       └── streamParser.test.ts
│
├── shared/                         # Tipos compartidos front/back
│   └── protocol.ts                 # Mensajes del WebSocket
│
└── config/
    └── projects.json               # Lista de proyectos donde correr agentes
```

## 5. Protocolo WebSocket

Todos los mensajes son JSON. Dos direcciones (client→server y server→client). Type discriminator + payload.

### Client → Server

```typescript
type ClientMessage =
  | { type: "open_session"; agentId: string; projectPath: string }
  | { type: "close_session"; sessionId: string }
  | { type: "send_message"; sessionId: string; content: string }
  | { type: "approve_tool"; sessionId: string; toolUseId: string }
  | { type: "reject_tool"; sessionId: string; toolUseId: string }
```

### Server → Client

```typescript
type ServerMessage =
  | { type: "session_opened"; sessionId: string; agentId: string }
  | { type: "session_closed"; sessionId: string }
  | { type: "message_chunk"; sessionId: string; delta: string }    // streaming de texto
  | { type: "message_complete"; sessionId: string; messageId: string }
  | { type: "tool_request"; sessionId: string; toolUseId: string; tool: string; input: unknown }
  | { type: "tool_result"; sessionId: string; toolUseId: string; output: string }
  | { type: "agent_state"; sessionId: string; state: AgentState }  // idle | thinking | tool_use | waiting_approval
  | { type: "error"; sessionId?: string; message: string }
```

### Estados de agente (para animación de NPC)

```typescript
type AgentState =
  | "idle"              // NPC parado, mirando cámara
  | "thinking"          // NPC con burbuja "..." animada
  | "typing_response"   // NPC tecleando en su compu
  | "tool_use"          // NPC consultando un "libro" (file read/write)
  | "waiting_approval"  // NPC con "!" sobre la cabeza
  | "error"             // NPC con "×" sobre la cabeza
```

## 6. Flujo de datos detallado

### Flujo: usuario abre un chat con "Tech Lead"

1. **Frontend** — Usuario click en botón `[+ Tech Lead]` del AgentDock.
2. **Frontend** — Envía `{ type: "open_session", agentId: "tech-lead", projectPath: "/c/Users/.../Apps-PSPMobile-FE" }`.
3. **Backend** — `SessionManager` recibe el mensaje.
4. **Backend** — Lee `.claude/agents/tech-lead.md` del projectPath, extrae el system prompt.
5. **Backend** — Spawnea proceso: `claude --print --output-format stream-json --input-format stream-json --append-system-prompt "$SYSTEM"`.
6. **Backend** — Crea `AgentSession` que wrappea el proceso y su stdin/stdout.
7. **Backend** — Responde `{ type: "session_opened", sessionId: "abc123", agentId: "tech-lead" }`.
8. **Frontend** — Guarda la sesión en estado Zustand.
9. **Frontend** — `WorldCanvas` detecta nueva sesión → spawnea NPC del Tech Lead en su escritorio asignado.
10. **Frontend** — `ChatContainer` renderiza nueva `ChatWindow` draggable.

### Flujo: usuario manda mensaje "diseñame un login biométrico"

1. **Frontend** — Usuario tipea en ChatWindow y apreta enter.
2. **Frontend** — Envía `{ type: "send_message", sessionId: "abc123", content: "..." }`.
3. **Backend** — `AgentSession` escribe al stdin del proceso Claude Code.
4. **Backend** — El parser de stdout detecta eventos de stream-json.
5. **Backend** — Por cada delta de texto, emite `message_chunk` al WS.
6. **Backend** — Cuando Claude decide usar una tool (ej. Read), emite `tool_request` con input.
7. **Frontend** — Recibe `tool_request` → muestra en ChatWindow un bloque "Claude quiere leer `src/login.tsx`. [Aprobar] [Rechazar]".
8. **Frontend** — NPC se anima a estado `waiting_approval` (burbuja `!`).
9. **Usuario** — Click en [Aprobar].
10. **Frontend** — Envía `{ type: "approve_tool", sessionId, toolUseId }`.
11. **Backend** — Permite al proceso ejecutar la tool, captura el output, emite `tool_result`.
12. **Frontend** — Renderiza el resultado plegable en el chat.
13. **Backend** — Si Claude sigue respondiendo, vuelve a emitir `message_chunk`.
14. **Frontend** — Al terminar, emite `message_complete`. NPC vuelve a `idle`.

### Flujo: usuario cierra el chat del Tech Lead

1. **Frontend** — Click en X de la ChatWindow.
2. **Frontend** — Envía `{ type: "close_session", sessionId: "abc123" }`.
3. **Backend** — Mata el proceso Claude Code correspondiente (SIGTERM, luego SIGKILL si no responde).
4. **Backend** — Libera la sesión del manager.
5. **Backend** — Responde `{ type: "session_closed", sessionId: "abc123" }`.
6. **Frontend** — NPC desaparece del mapa con animación de fade-out.
7. **Frontend** — ChatWindow se cierra.

## 7. Modelo de datos del frontend

### Estado Zustand — `useAgentSessions`

```typescript
type AgentSession = {
  sessionId: string
  agentId: string              // "tech-lead", "dev-backend", etc
  agentName: string            // "Tech Lead"
  state: AgentState
  messages: Message[]
  pendingToolRequest?: ToolRequest
  windowPosition: { x: number; y: number }   // ventana de chat
  npcPosition: { x: number; y: number }      // posición en el mapa
  npcDeskId: string            // qué escritorio ocupa
}

type Message =
  | { role: "user"; content: string; timestamp: number }
  | { role: "assistant"; content: string; timestamp: number; toolCalls: ToolCall[] }

type ToolCall = {
  toolUseId: string
  tool: string
  input: unknown
  status: "pending_approval" | "executing" | "completed" | "rejected"
  output?: string
}
```

### Estado Zustand — `useMapState`

```typescript
type MapState = {
  desks: Desk[]                // escritorios fijos del mapa
  tiles: Tile[][]              // matriz del tilemap
  assignments: Map<string, string>   // deskId → sessionId
}
```

## 8. Registry de agentes

En `frontend/lib/agents.ts` + sincronizado con `backend/src/config/loadAgents.ts`:

```typescript
type AgentDefinition = {
  id: string                   // "tech-lead" (coincide con nombre del .md)
  displayName: string          // "Tech Lead"
  description: string          // shown en el botón del dock
  spriteKey: string            // clave del sprite pixel art
  deskId: string               // escritorio fijo asignado
  color: string                // acento visual (burbujas, borde ventana)
  mdPath: string               // "./.claude/agents/tech-lead.md"
  model?: string               // override del modelo si se quiere
}

const AGENTS: AgentDefinition[] = [
  {
    id: "tech-lead",
    displayName: "Tech Lead",
    description: "Arquitectura, ADRs, trade-offs",
    spriteKey: "character_tech_lead",
    deskId: "desk_corner_north",
    color: "#7F77DD",
    mdPath: "./.claude/agents/tech-lead.md"
  },
  // ... resto
]
```

## 9. Layout del mapa

### Tamaño
- 32 tiles ancho × 20 tiles alto.
- Tile size: 32px → total 1024×640 en canvas.

### Zonas
- **Entrada** (fila 0-2): puerta, alfombra, planta.
- **Escritorios** (fila 4-14): 8 escritorios, uno por agente. 2 columnas de 4, con pasillo central.
- **Sala de reunión** (fila 16-19): mesa redonda + 6 sillas. Reservada para cuando haya orquestación multi-agente (fuera de MVP).
- **Cafetera** (esquina sup-derecha): animación idle eterna, decorativa.

### Asignación de escritorios a agentes (fija, hardcoded en MVP)

| Escritorio | Agente |
|---|---|
| desk_01 | Product Owner |
| desk_02 | Analista Funcional |
| desk_03 | Tech Lead |
| desk_04 | UX/UI |
| desk_05 | Dev Backend |
| desk_06 | Dev Frontend Mobile |
| desk_07 | QA / Tester |
| desk_08 | DevOps |

Si se agrega QE Automation (noveno agente), se agrega un escritorio libre.

## 10. Sprites y assets

### MVP mínimo (Fase 1)
- 1 sprite para NPCs genéricos (usado para todos los agentes con tint de color distinto).
- Tiles básicos de piso y pared.
- No hay animaciones complejas, solo cambio de postura por estado.

### Fase 2 (si el MVP gusta)
- 8 sprites diferenciados por agente.
- Animaciones idle, typing, waiting.
- Muebles detallados (monitores encendidos según estado del agente).

### Fuentes recomendadas
- **Limezu's Modern Office** (itch.io, gratis, comercial OK con atribución).
- **Kenney.nl Tiny Town / Office pack**.
- **Pixel Agents del Claude Office** (si el usuario quiere reusar).

## 11. Autenticación y Claude Code headless

### Contexto
Claude Code CLI tiene modo no interactivo para integraciones programáticas:

```bash
claude --print \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt "$(cat .claude/agents/tech-lead.md)" \
  --cwd /path/to/project
```

Esto:
- Usa la sesión existente del usuario (Claude Max vía OAuth).
- No pide API key.
- Consume tokens de la suscripción Max.
- Stream-json permite parsear events (message deltas, tool_use, tool_result).

### Handler de permisos
En modo no interactivo, Claude Code **pide aprobación por cada tool use**. El backend debe:
1. Detectar el evento `tool_use` en el stream.
2. Enviarlo al frontend como `tool_request`.
3. Esperar la respuesta del usuario vía `approve_tool` / `reject_tool`.
4. Escribir al stdin del proceso la decisión.

Claude Code provee hooks para esto vía `--permission-mode` y `--allowed-tools`. Ver documentación oficial al momento de implementar.

### Variables de entorno críticas

```bash
# NO setear ANTHROPIC_API_KEY — si está, Claude Code factura por API
# en vez de consumir la suscripción.
unset ANTHROPIC_API_KEY
```

El backend debe hacer `delete env.ANTHROPIC_API_KEY` antes de spawnear procesos.

## 12. Seguridad y sandboxing

### Alcance del MVP
- **Uso estrictamente local**. Backend bindea a `127.0.0.1`, jamás `0.0.0.0`.
- **No exponer a la red**. Firewall-level y config-level.
- **Una sola instancia por usuario**. No hay multi-tenant.

### Permisos de tools
- Toda tool use **requiere aprobación explícita** en el MVP. No hay "aprobar siempre".
- Opción futura: allow-list de tools por agente (ej: QA puede correr tests sin preguntar, pero no puede hacer git push).

### Proyectos permitidos
- Archivo `config/projects.json` lista los proyectos donde se pueden abrir sesiones.
- Intentar abrir sesión en un path fuera de la lista → error.

```json
[
  {
    "name": "Apps-PSPMobile-FE",
    "path": "/c/Users/LuisSandoval/OneDrive/Escritorio/TRABAJO/Mutual/repos Mutual/Apps-PSPMobile-FE",
    "description": "App mobile React Native + Expo de home banking"
  }
]
```

## 13. Plan de implementación por fases

**Cada fase es un entregable funcional probable, no un hito arbitrario.** Al final de cada fase, el usuario puede probar algo real y decidir si continúa.

### Fase 0 — Setup del monorepo (1 día)

**Entregable**: `pnpm dev` levanta frontend en :3000 y backend en :3001, hacen ping pong por WS.

Tareas:
- [ ] Inicializar monorepo con pnpm workspaces.
- [ ] Configurar frontend Next.js 15 + Tailwind + shadcn/ui.
- [ ] Configurar backend Fastify + @fastify/websocket.
- [ ] Implementar ruta `/health` en backend.
- [ ] Implementar conexión WebSocket frontend ↔ backend con ping/pong.
- [ ] Script `pnpm dev` con concurrently levantando ambos.
- [ ] `.env.example`, README con setup.

**Test de aceptación**: abrir localhost:3000, ver "Connected to backend" en la UI.

### Fase 1 — Un chat funcional end-to-end (2 días)

**Entregable**: el usuario puede abrir UN chat con el Tech Lead, conversar con él, y el agente puede leer/editar archivos del proyecto Apps-PSPMobile-FE con aprobación humana.

Tareas:
- [ ] Implementar `SessionManager` y `AgentSession` en backend.
- [ ] Spawneo de proceso Claude Code headless con stream-json.
- [ ] Parser de stream-json a eventos del protocolo.
- [ ] Frontend: un único `ChatWindow` hardcodeado al Tech Lead (sin dock todavía).
- [ ] UI de mensajes con soporte para tool requests y approvals.
- [ ] Loader del system prompt desde `.claude/agents/tech-lead.md`.
- [ ] Manejo de errores del proceso (muerto, timeout, etc).

**Test de aceptación**: pedirle al Tech Lead "explicame la estructura del proyecto", él lee archivos con aprobación, responde con un resumen.

### Fase 2 — Múltiples chats en paralelo (1 día)

**Entregable**: el usuario puede abrir 3 chats distintos (ej: PO + Tech Lead + Dev Backend) y conversar con los tres al mismo tiempo. Cada uno es un proceso separado.

Tareas:
- [ ] Implementar `AgentDock` con todos los agentes.
- [ ] Múltiples instancias de `ChatWindow` draggable.
- [ ] Gestión de foco entre ventanas.
- [ ] Cierre de sesiones (mata procesos).
- [ ] Indicadores de estado por chat (idle/thinking/tool_use).

**Test de aceptación**: abrir 3 chats, mandar mensajes en paralelo a los 3, verificar que responden independientemente.

### Fase 3 — Mapa pixel art con NPCs (2 días)

**Entregable**: el canvas PixiJS renderiza una oficina con escritorios, y los NPCs aparecen cuando se abre un chat.

Tareas:
- [ ] Setup de PixiJS v8 en un componente React.
- [ ] Render del tilemap de oficina (32×20 tiles).
- [ ] Carga de sprites de NPCs (1 sprite genérico + tints).
- [ ] Sincronizar NPCs con sesiones activas (subscribe a Zustand).
- [ ] Animaciones básicas por estado (idle = parado, thinking = burbuja `...`, tool_use = burbuja de libro).
- [ ] Transiciones fade-in / fade-out al abrir/cerrar chat.

**Test de aceptación**: abrir un chat → aparece NPC en su escritorio. Mandar mensaje → NPC muestra "..." mientras piensa. Cerrar chat → NPC desaparece.

### Fase 4 — Polish y quality of life (1 día)

**Entregable**: la app es cómoda de usar en el día a día.

Tareas:
- [ ] Persistencia de posición de ventanas en localStorage.
- [ ] Dark mode toggle.
- [ ] Keyboard shortcuts (Ctrl+1-8 para abrir agentes, Esc para cerrar foco).
- [ ] Notificación del sistema cuando un agente termina de responder (si la ventana está fuera de foco).
- [ ] Logs del backend visibles en dev tools.
- [ ] README completo con demo.

**Test de aceptación**: el usuario lo usa un día completo sin fricción.

### Fases fuera de scope del MVP

- Video chat (no aplica, son agentes).
- Multi-user real (un solo usuario por definición).
- Editor de mapas (los escritorios son fijos).
- Avatar humano controlable (el usuario no "camina" por el mapa).
- Tool approvals automáticas / allow-lists avanzadas.
- Persistencia de conversaciones entre sesiones (cada apertura de chat es limpia).
- Multi-proyecto simultáneo (solo un projectPath activo).

## 14. Decisiones técnicas con justificación

### ¿Por qué Fastify y no Express?
- Más rápido, mejor typing nativo, soporte WebSocket oficial vía plugin.
- Menos overhead para un backend que solo orquesta procesos.

### ¿Por qué PixiJS y no Phaser?
- Claude Office ya usa PixiJS → podemos robar patterns y sprites.
- Phaser es más pesado y orientado a juegos completos; no necesitamos game loop complejo.

### ¿Por qué Zustand y no Redux?
- API mínima, sin boilerplate, perfecto para estado local single-user.
- Persistencia fácil con middleware.

### ¿Por qué Claude Code como ejecutor y no la API directa?
- Ahorra mes implementar tool use, permisos, file ops, bash.
- Usa la suscripción Max del usuario (gratis en el margen, tope fijo).
- Si Claude Code mejora, la app mejora sola.

### ¿Por qué subprocess en lugar de una librería?
- Claude Code no tiene SDK oficial para Node.js aún (al momento de escribir).
- subprocess + stream-json es el patrón recomendado por Anthropic para integraciones.

## 15. Qué pasa si algo falla

| Problema | Comportamiento |
|---|---|
| Backend no levanta | Frontend muestra "Backend desconectado" con botón reintentar |
| WS se corta a mitad de una sesión | Reconecta auto; la sesión en backend sigue viva; frontend pide `resync` |
| Claude Code no responde en 60s | Emite `error` al frontend; UI muestra "Agente timeout, reintentá" |
| ANTHROPIC_API_KEY está seteada | Backend aborta al iniciar con mensaje claro |
| Proyecto en projectPath no existe | Error en `open_session`; UI muestra "Proyecto no encontrado" |
| `.claude/agents/<id>.md` no existe | Error en `open_session`; UI sugiere correr el instalador |
| Usuario spamea 20 chats | Limite soft de 10 simultáneos; después: "Cerrá algunos primero" |

## 16. Instrucciones para Claude Code al implementar

Cuando leas este documento para empezar a codear:

1. **No improvises features fuera del scope.** Si una tarea no está listada en una fase, no la hagas. Si te parece útil, dejala como TODO comentado.
2. **Respetá el protocolo WebSocket al pie de la letra.** Los tipos están definidos en la sección 5 — implementalos exactamente así en `shared/protocol.ts`.
3. **Fase por fase.** No saltes adelante. Al terminar cada fase, resumí qué quedó y pedí review al usuario antes de avanzar.
4. **Tests de aceptación.** Al final de cada fase, escribí en el chat cómo probarlo manualmente para que el usuario valide.
5. **Dependencias.** Usá siempre las últimas versiones stable al momento de instalar. Si algo requiere versión específica, documentalo en el README.
6. **Commit por tarea completada.** Un commit por checkbox del plan. Mensajes en inglés, formato conventional commits.
7. **Sin magic numbers.** Todo número que no sea 0, 1 o -1 va a constantes con nombre.
8. **Errores siempre con contexto.** Nunca `throw new Error("failed")`. Siempre `throw new Error("Failed to spawn Claude Code process for agent=tech-lead: <original>")`.

## 17. Referencia rápida de comandos

```bash
# Bootstrap (una sola vez)
pnpm install

# Desarrollo (levanta todo)
pnpm dev

# Tests
pnpm test

# Build producción (opcional, el MVP corre en dev mode)
pnpm build
pnpm start

# Clean
pnpm clean
```

## 18. Abiertos para decidir más adelante

- **Empaquetado**: si queda sólido, ¿lo empaquetamos como Electron para que sea app nativa en vez de browser + node separados?
- **Claude Code SDK**: cuando Anthropic libere SDK oficial para Node.js, migrar del subprocess.
- **Multi-agente orquestado**: un "Project Manager" agent que coordine múltiples agentes ejecutando tareas complementarias.
- **Persistencia de sesiones**: poder retomar una conversación de ayer.
- **Voice input/output**: hablarle al Tech Lead por micrófono.
- **Compartir sesiones con equipo**: modo "look over my shoulder".

---

**Última revisión**: este documento vive en la raíz del proyecto como `ARCHITECTURE.md` y debe actualizarse cada vez que se complete una fase o cambie una decisión técnica.
