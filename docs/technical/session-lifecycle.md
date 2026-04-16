# Session Lifecycle — Spawn, streaming, approvals, kill

**Referencias**: ADR-005 (seguridad de paths), `websocket-protocol.md`, `ARCHITECTURE.md` v0 § 11.

## 1. Constantes

```typescript
export const SESSION_MAX_CONCURRENT = 10;
export const SESSION_SPAWN_TIMEOUT_MS = 15000;
export const SESSION_IDLE_TIMEOUT_MS = 3600000;  // 1h
export const SESSION_KILL_GRACE_MS = 5000;
export const SESSION_STREAM_PARSE_BUFFER_MAX_BYTES = 1048576;  // 1 MB backpressure
export const SESSION_HEARTBEAT_CHECK_MS = 30000;
```

## 2. Estados

```
created → spawning → running → closing → closed
                        ├→ waiting_tool_approval → running
                        └→ error → closed
```

- **created**: objeto instanciado, no hay proceso aún.
- **spawning**: subprocess arrancado, esperando primera señal de vida (stdout con JSON válido).
- **running**: subprocess respondiendo, consumiendo eventos.
- **waiting_tool_approval**: pausado esperando approve/reject del usuario.
- **closing**: se pidió kill, esperando exit.
- **closed**: proceso terminado, recursos liberados.
- **error**: crash o spawn failure; siempre transita a closed.

## 3. Spawn

### 3.1 Pre-flight (ADR-005)

Antes de spawnear:

1. Verificar `SessionManager.sessions.size < SESSION_MAX_CONCURRENT`. Si no → error `session_limit_reached`.
2. Verificar que `agentId` existe en registry (builtin o custom).
3. `validateProjectPath(projectPath)`:
   - `fs.realpathSync()` para resolver symlinks.
   - Check denylist.
   - Check `fs.statSync().isDirectory()`.
   - Si warnlist → devolver `path_requires_confirmation`.
4. Resolver el system prompt:
   - **Builtin**: leer `<projectPath>/.claude/agents/<agentId>.md` si existe, sino `<bundle>/agents/<agentId>.md`.
   - **Custom**: leer `~/.agent-workbench/agents/<agentId>/prompt.md`.
5. Resolver env:
   ```typescript
   const env = {
     PATH: process.env.PATH,
     HOME: process.env.HOME,
     USERPROFILE: process.env.USERPROFILE,
     LANG: process.env.LANG ?? "en_US.UTF-8",
     TZ: process.env.TZ,
     TERM: "xterm-256color",
   };
   // NUNCA heredar ANTHROPIC_API_KEY (ver ARCHITECTURE.md v0 § 11)
   delete env.ANTHROPIC_API_KEY;
   ```

### 3.2 Comando

```bash
claude \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt "$SYSTEM_PROMPT" \
  --permission-mode approval \
  --cwd "$PROJECT_PATH"
```

**Ojo**: la flag exacta para que Claude Code pida aprobación por cada tool use **debe validarse contra la versión instalada** (ver SPIKE-02 en `risks-and-spikes.md`).

### 3.3 Timeout de spawn

Si en `SESSION_SPAWN_TIMEOUT_MS` el subprocess no emitió el primer evento válido de stream-json → kill y emitir `error` con `subprocess_spawn_failed`.

### 3.4 Backpressure

- stdout → readline (split por `\n`).
- Buffer interno max `SESSION_STREAM_PARSE_BUFFER_MAX_BYTES`. Si excede → kill con error `internal_error` y log.
- WS writes son async; si el browser está lento, node-ws encola. Soft-limit `SESSION_STREAM_PARSE_BUFFER_MAX_BYTES * 4` en socket buffer → pausar lectura del subprocess con `process.stdout.pause()`.

## 4. Streaming

### 4.1 Parser de stream-json

Cada línea es un JSON. Eventos relevantes (forma exacta a validar en SPIKE-02):

```json
{"type":"message_start","message":{"id":"msg_..."}}
{"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
{"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"..."}}
{"type":"content_block_start","content_block":{"type":"tool_use","id":"toolu_...","name":"Read","input":{}}}
{"type":"content_block_stop"}
{"type":"message_delta","delta":{"stop_reason":"end_turn"}}
{"type":"message_stop"}
{"type":"tool_result","tool_use_id":"toolu_...","content":"..."}
```

### 4.2 Mapeo a protocolo WS

| Evento Claude | Mensaje WS |
|---|---|
| `message_start` | `{ type: "agent_state", state: "typing_response" }` |
| `content_block_delta` (text_delta) | `{ type: "message_chunk", delta }` |
| `content_block_start` (tool_use) | `{ type: "tool_request", tool, input }` + estado `waiting_approval` |
| Result local tras aprobar | `{ type: "tool_result", status, output }` |
| `message_stop` | `{ type: "message_complete" }` + estado `idle` |
| error stderr / exit code ≠ 0 | `{ type: "error", code, message }` |

## 5. Aprobaciones (human-in-the-loop)

### 5.1 Flujo

1. Parser detecta `tool_use`. `SessionManager.pendingApprovals.set(toolUseId, request)`.
2. Emite `tool_request` al WS. Estado → `waiting_approval`.
3. Cliente responde `approve_tool` o `reject_tool`.
4. Backend escribe al stdin del subprocess la respuesta en el formato stream-json que Claude espera (a validar en SPIKE-02).
5. Subprocess ejecuta la tool → emite `tool_result` → backend lo rutea al WS.
6. Estado vuelve a `running`.

### 5.2 Timeouts

- No hay timeout de aprobación por defecto (el usuario puede tomarse el tiempo).
- Si el usuario cierra la sesión con aprobaciones pendientes → todas se marcan como rejected y se mata el proceso.

## 6. Close / Kill

### 6.1 User-requested (`close_session`)

1. `SessionManager.close(sessionId)`.
2. Cierra pty asociadas (ver `terminal-integration.md`).
3. Envía SIGTERM al subprocess.
4. Espera `SESSION_KILL_GRACE_MS`.
5. Si sigue vivo → SIGKILL.
6. Emite `session_closed` con `reason: "user"`.

### 6.2 Idle timeout

Un ticker cada `SESSION_HEARTBEAT_CHECK_MS` evalúa `lastActivityAt`. Si `now - lastActivityAt > SESSION_IDLE_TIMEOUT_MS` → kill con reason `"timeout"`.

`lastActivityAt` se actualiza en cada mensaje user→agent y cada evento del subprocess.

### 6.3 Crash

- Subprocess `exit` event con código ≠ 0 o señal → emitir `session_closed` con `reason: "crash"` y `error` con detalles.

### 6.4 WS disconnect

- Cliente desconecta → **no kill inmediato**. Se marca la sesión como "detached" y se espera reconnect.
- Si reconnect antes de `SESSION_IDLE_TIMEOUT_MS` → el cliente rehidrata vía `get_agents` + opcional `get_session_state` (ver `open-questions.md`, decisión pendiente).
- Si expira → kill con reason `"timeout"`.

## 7. Manejo de errores

| Condición | Acción |
|---|---|
| Spawn timeout | Kill + `error: subprocess_spawn_failed` |
| Stdin write failure | Kill + `error: internal_error` |
| stdout parse error (JSON inválido) | Log warning, skip línea, continuar |
| Buffer overflow (línea > max) | Kill + `error: internal_error` |
| `ANTHROPIC_API_KEY` detectada en env heredado | Abort al startup del server, no arrancar |
| `.claude/agents/<id>.md` y fallback faltante | `error: agent_not_found`, no spawn |
| Usuario pica `reject_tool` | Escribir rechazo a stdin, continuar flow |
| Tool bash del agente intenta escribir en path fuera de projectPath | N/A a este layer — responsabilidad de Claude Code CLI y su sandboxing. Ver `risks-and-spikes.md` (SPIKE-04). |

## 8. ANTHROPIC_API_KEY

Heredado de `ARCHITECTURE.md` v0 § 11 y reforzado por ADR-005:

- **Nunca pasar la env var al subprocess**. Se hace `delete env.ANTHROPIC_API_KEY` en el env filtrado antes de `spawn`.
- **En el proceso del backend**: si está seteada, log warning al startup. La autenticación del CLI usa la sesión OAuth del usuario (Claude Max) guardada por el propio CLI en `~/.claude/`.
- **Si el usuario la necesita para scripts propios**: se deja en el shell del usuario (tab Bash hereda env? Ver `terminal-integration.md` — decisión: pty hereda env **completo** del usuario, incluyendo `ANTHROPIC_API_KEY`, porque es su shell real. El filtro aplica solo al subprocess de Claude Code).

## 9. Concurrencia

- Un solo `SessionManager` (singleton).
- `Map<SessionId, AgentSession>` como store, no hay locking porque Node es single-threaded.
- Writes concurrentes a `characters.json` se serializan vía `Promise` chain en `CharacterStore.update()`.

## 10. Logging

- `pino` a stdout en dev, rotado a `backend/logs/` en prod local.
- Log levels:
  - `info`: open/close de sesiones, updates de custom agents.
  - `warn`: archivos con schema inválido, path en warnlist aceptado, backpressure activado.
  - `error`: spawn failure, crash, backpressure overflow.
- **Nunca loguear** el system prompt ni el contenido de los mensajes (privacidad).
