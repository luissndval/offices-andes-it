# Terminal Integration — xterm.js + node-pty

**Referencias**: ADR-004, `websocket-protocol.md`, `session-lifecycle.md`.

## 1. Objetivo

Cada `ChatWindow` expone dos tabs de terminal:

- **Agente (observer)**: read-only. Renderiza los `tool_request` / `tool_result` de Claude Code formateados como si fueran comandos + output. No es una pty, es una vista derivada.
- **Bash (interactive)**: shell real. pty vinculada a `node-pty` en backend, xterm.js en frontend, con el `cwd` del chat.

Ambas viven en la misma `ChatWindow`. Tab switching es puramente visual, ambos buffers se mantienen vivos.

## 2. Stack

### Frontend
- `xterm` (core)
- `@xterm/addon-fit` — ajuste a tamaño del contenedor.
- `@xterm/addon-web-links` — click en URLs.
- `@xterm/addon-webgl` — opcional si rinde mal en CPU (evaluar en polish, no MVP).

### Backend
- `node-pty` (bindings nativos a forkpty/winpty).
- En Windows 10+: usa ConPTY (incluido en node-pty 1.0+).
- En Linux/macOS: pty POSIX.

## 3. Constantes

```typescript
export const PTY_DEFAULT_COLS = 120;
export const PTY_DEFAULT_ROWS = 30;
export const PTY_INPUT_MAX_BYTES = 8192;
export const PTY_OUTPUT_CHUNK_MAX_BYTES = 16384;
export const PTY_LATENCY_WARN_MS = 100;
export const PTY_SHELL_POSIX = "/bin/bash";
export const PTY_SHELL_WINDOWS = "powershell.exe";
```

Shell es parametrizable por env `AGENT_WORKBENCH_SHELL`; default según OS.

## 4. Flujo de datos (interactive tab)

```
Usuario teclea en xterm
       │
       ▼
xterm.onData((data) => {
  ws.send({ type: "pty_input", ptyId, dataBase64: btoa(data) });
});
       │
       ▼
WS → Backend
       │
       ▼
PtyManager.get(ptyId).write(Buffer.from(dataBase64, "base64"));
       │
       ▼
node-pty.on("data", (chunk) => {
  ws.send({ type: "pty_output", ptyId,
           dataBase64: Buffer.from(chunk).toString("base64") });
});
       │
       ▼
Frontend: xterm.write(atob(dataBase64));
```

## 5. Ciclo de vida de una pty

1. **Open** — Cliente envía `pty_open` con `sessionId`, `cols`, `rows`.
2. Backend valida que la `sessionId` exista y esté en estado distinto a `closed`/`error`.
3. Backend spawnea pty con `cwd = session.projectPath`, shell según OS, env del usuario completo (ver sección 8).
4. Backend emite `pty_opened` con `ptyId` generado.
5. **Data loop** — `pty_input` ↔ `pty_output`.
6. **Resize** — `pty_resize` con nuevos `cols`/`rows`. Backend llama `pty.resize(cols, rows)`.
7. **Close** — Cliente envía `pty_close`, o la sesión asociada se cierra → SIGTERM a la pty, luego kill si no responde en `SESSION_KILL_GRACE_MS`.
8. **Exit** — Backend emite `pty_exit` con `exitCode` y `signal` si aplica.

## 6. Observer tab (read-only)

No hay pty. Es un componente React que consume los eventos del stream del agente:

```typescript
type ObserverEntry =
  | { kind: "tool_request"; toolUseId; tool; input; status: ToolStatus }
  | { kind: "tool_result"; toolUseId; output?; error? }
  | { kind: "agent_state_change"; from: AgentState; to: AgentState };
```

Formato visual de ejemplo:

```
[tech-lead] ┌─ Read ─ pending approval
[tech-lead] │  file_path: /home/u/proj/src/App.tsx
[tech-lead] │  offset: 0, limit: 200
[tech-lead] └─ [Approve] [Reject]

[tech-lead] ┌─ Read ─ completed in 42ms
[tech-lead] │  1  import React from "react";
[tech-lead] │  2  ...
[tech-lead] │  (showing 200 of 840 lines)
[tech-lead] └─
```

Render con xterm escribiendo ANSI coloreado pre-formateado, o con componentes React dentro de un `<div>` con font monoespaciada. Decisión: **React + Tailwind**, no xterm — el observer no necesita emulación VT100.

## 7. Separación observer / interactive

| Aspecto | Observer (Agente) | Interactive (Bash) |
|---|---|---|
| Tipo | Vista derivada del stream del agente | pty real |
| Input | Solo [Approve]/[Reject] en tool requests | Bytes al stdin de pty |
| Output | Formateado desde eventos WS | Raw bytes base64 del pty |
| Mueve con sesión | Sí (se cierra al cerrar sesión) | Sí (pty cierra al cerrar sesión) |
| Historial | Mantiene toda la historia del agente | scrollback de xterm configurable |
| CWD | Implícito (mismo que sesión) | Inicial = projectPath; user puede `cd` |

## 8. Env de la pty

- Hereda el env **completo** del proceso del backend (incluyendo `ANTHROPIC_API_KEY` si está). Es el shell del usuario, su responsabilidad.
- Variables que sí setea el backend siempre:
  - `TERM=xterm-256color`
  - `COLORTERM=truecolor`
  - `LANG` si no existe: `en_US.UTF-8`.

## 9. Resize

- `@xterm/addon-fit` calcula el tamaño según el contenedor.
- ResizeObserver → debounced 150 ms → `pty_resize`.
- Backend: `pty.resize(cols, rows)`. No hay ACK — es best-effort.

## 10. Límites y anti-flood

- **Output rate limiting** (defensivo): si una pty emite > `PTY_OUTPUT_CHUNK_MAX_BYTES * 100` por segundo, pausar lectura del pty 100ms. Evita un `yes` que congele el backend.
- **Input**: single message max `PTY_INPUT_MAX_BYTES`. Si el front intenta pegar 100 KB → el frontend split en chunks.
- **Concurrency**: máximo 3 pty por session (MVP), 10 totales.

## 11. Decisiones que requieren spike

Ver `risks-and-spikes.md`:
- **SPIKE-01** — Throughput real de multiplexado JSON+base64 con 3 pty + 3 agentes activos.
- **SPIKE-03** — Behavior de node-pty + ConPTY en Windows para aplicaciones interactivas (vim, top).

## 12. Problemas conocidos

| Problema | Mitigación |
|---|---|
| `node-pty` requiere build tools nativos (python, make) | Documentar en README. Si rompe: `prebuild-install` fallback. |
| ConPTY tiene glitches en apps TUI complejas (vim hybrid mode) | Aceptado para MVP. Usuario puede usar wsl si está. |
| xterm.js + React 19 strict mode → doble mount | Usar `useEffect` con cleanup correcto, o lazy init. Ver pixel-agents para patrón. |
| Copy-paste en Linux sin selectionService configurado | Habilitar `rightClickSelectsWord` + `Ctrl+Shift+C/V` default. |
| Secretos en scroll buffer del observer | No loguear `tool_result` completo a disco en el backend (ver `session-lifecycle.md` § 10). |

## 13. Testing

- Unit: parser de stream-json → observer entries.
- Integration: spawn de pty con comando simple (`echo hola`), verificar output.
- E2E (Playwright, opcional MVP): abrir sesión, ir a tab Bash, tipear `ls`, verificar que xterm muestra contenido.
