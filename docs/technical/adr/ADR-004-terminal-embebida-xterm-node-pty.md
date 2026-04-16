# ADR-004: Terminal embebida — xterm.js + node-pty y multiplexado sobre WebSocket

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

Cada `ChatWindow` tiene dos tabs de terminal:

1. **Agente (observer)** — read-only, muestra los tool calls que Claude Code está ejecutando (Read, Write, Bash, Edit, etc.) en formato human-readable. Es "lo que el agente está haciendo", no una shell.
2. **Bash (interactive)** — shell real conectada a una pty del sistema, con el `cwd` del chat. El usuario puede ejecutar comandos a mano en paralelo al agente (ej: `git status`, `ls`, `npm test`).

El reto técnico es **cómo conviven en un mismo WebSocket** el stream-json de Claude Code (eventos estructurados) y los bytes crudos de la pty (secuencias ANSI, control chars), sin romper ninguno de los dos protocolos y manteniendo el código mantenible.

Constantes del protocolo (ver `websocket-protocol.md`):
- `PTY_DEFAULT_COLS = 120`
- `PTY_DEFAULT_ROWS = 30`
- `PTY_INPUT_MAX_BYTES = 8192`
- `PTY_OUTPUT_CHUNK_MAX_BYTES = 16384`

## Opciones consideradas

### Opción A: Un solo WebSocket, mensajes JSON tipados para todo (incluso pty bytes en base64)

**Pros**
- Una sola conexión por sesión → menos sockets, menos reconnect logic.
- Protocolo uniforme: todo es `ServerMessage` discriminado por `type`.
- Fácil de loguear y testear (todo es JSON).

**Contras**
- Overhead de base64 (~33% más bytes) para payloads de pty grandes (output de `cat archivo.json`).
- Serialización JSON en cada chunk → CPU en backend para streams ruidosos.
- Un cliente lento bloquea todos los streams multiplexados.

### Opción B: Dos WebSockets — uno para protocolo de agente (JSON), otro para pty (binary frames)

**Pros**
- Separación limpia: el WS de pty manda binary frames, sin JSON.
- Performance óptima para throughput de pty.
- Si se cae uno, el otro sigue (útil para observer).

**Contras**
- Doble connect, doble auth (handshake), doble reconnect.
- Sincronización: eventos del WS del agente que referencian cwd de la pty deben estar coordinados.
- Más complejidad de código cliente (useWebSocket × 2).

### Opción C: Un solo WebSocket con frames binarios marcados por prefijo de 1 byte (multiplexado)

**Pros**
- Una sola conexión.
- Sin overhead de base64 — pty bytes van raw después del byte de canal.
- Performance similar a B.

**Contras**
- Rompe la pureza "todo es JSON" → logging y testing requieren parser custom.
- Necesita encoder/decoder compartido front-back mantenido en lockstep.
- El stack WS (Fastify + ws browser) soporta binary frames sin problema, pero la DX de debugging cae.

## Decisión

**Opción A** con dos matices pragmáticos:

1. **Pty output en base64 dentro de JSON** con `type: "pty_output"`. El overhead de ~33% es aceptable porque:
   - Es local (127.0.0.1), bandwidth no es problema.
   - Volúmenes esperados son bajos (sesión de dev, no streaming de video).
   - Uniformidad gana mantenibilidad y observabilidad.
2. **Límite duro** de chunk de pty a `PTY_OUTPUT_CHUNK_MAX_BYTES`; el backend parte buffers grandes en múltiples mensajes.

Observer (agente) **no necesita** ser pty — consume eventos `tool_request` / `tool_result` del stream-json de Claude Code y los renderiza formateados. No hay segundo proceso ni segunda pty.

Si en Fase 5+ la métrica de latencia de pty supera `PTY_LATENCY_WARN_MS = 100` en p95 con 3 sesiones activas, revisamos y pasamos a Opción C.

## Consecuencias

### Positivas
- Un solo WebSocket, un solo reconnect path, un solo logger.
- Tipos TS completos en `shared/protocol.ts` para pty también.
- Testing trivial — los tests mockean mensajes JSON sin setup binario.

### Negativas / Trade-offs aceptados
- ~33% overhead en payloads de pty (aceptable en localhost).
- Serialización JSON en hot path de output de pty.
- No podemos pipear pty bytes directo al `WebSocket.send()` — pasa por transform.

### Acciones derivadas
- [ ] Definir mensajes `pty_open`, `pty_input`, `pty_output`, `pty_resize`, `pty_close`, `pty_exit` en `shared/protocol.ts` (ver `websocket-protocol.md`).
- [ ] Backend: `PtyManager` que mantiene `Map<ptyId, IPty>` de `node-pty`, con lifecycle ligado a la sesión.
- [ ] Frontend: `useTerminal(sessionId)` que monta xterm.js, emite input al WS, consume output.
- [ ] Métrica de warning: `pty_output` > `PTY_OUTPUT_CHUNK_MAX_BYTES` debe loguearse en backend.
- [ ] Sandboxing pty: respetar `projectPath` del chat como `cwd` inicial, heredar env filtrado (`delete env.ANTHROPIC_API_KEY`).
- [ ] Ver `SPIKE-01` (terminal-integration.md → riesgos) para validar throughput real antes de Fase 4.

## Referencias
- https://github.com/xtermjs/xterm.js
- https://github.com/microsoft/node-pty
- `docs/technical/terminal-integration.md`
- `docs/technical/websocket-protocol.md`
