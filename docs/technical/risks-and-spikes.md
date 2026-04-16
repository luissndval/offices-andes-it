# Riesgos técnicos y Spikes propuestos

**Referencias**: todos los ADR y docs técnicos.

## 1. Matriz de riesgos

Severidad: **Alta** (bloquea MVP o implica rework mayor), **Media** (impacto medible en calidad/tiempo), **Baja** (manejable con plan B).

Probabilidad: Alta / Media / Baja.

| # | Riesgo | Severidad | Probabilidad | Mitigación | Spike |
|---|---|---|---|---|---|
| R1 | Flags de aprobación de tools en `claude` CLI cambiaron o no son las del ARCHITECTURE v0 | **Alta** | Alta | Validar `claude --help` contra la versión instalada antes de implementar; documentar en ADR si hay divergencia | **SPIKE-02** |
| R2 | Multiplexado stream-json + pty (base64) en un solo WS degrada performance con > 2 pty activas | **Alta** | Media | Medir con PoC; fallback a Opción C (frames binarios) de ADR-004 | **SPIKE-01** |
| R3 | `node-pty` en Windows (ConPTY) se rompe con apps TUI complejas (vim, htop) | Media | Media | Documentar apps soportadas; recomendar WSL para power users | **SPIKE-03** |
| R4 | Desacoplar pixel-agents de la API de VS Code es más caro que lo estimado | **Alta** | Media | Spike de timebox duro; si excede → fallback a Opción A (build from scratch reducido) | **SPIKE-04** |
| R5 | Tool del agente con Bash habilitado escribe fuera de `projectPath` | Media | Media | Aceptar en MVP (responsabilidad del Claude Code CLI). Sandboxing real queda para Fase 5+ | - |
| R6 | Prompt injection vía `prompt.md` de custom agent malicioso | Baja | Baja | Aceptado (local, single-user). Documentar en README | - |
| R7 | Subprocess de Claude Code queda zombie al crashear el backend | Media | Media | `process.on("exit")` + `unref()` de timers; kill tree con `tree-kill` en cleanup | - |
| R8 | WS cliente lento → backpressure bloquea lectura de subprocess → el agente se cuelga | Media | Media | Buffer limit + `process.stdout.pause()` / `resume()` (ver `session-lifecycle.md` § 3.4) | - |
| R9 | `characters.json` corrupto por interrupción a mitad de escritura | Baja | Baja | Write atómico (tmp + rename). Backup renameo a `.corrupt.<ISO>.json` | - |
| R10 | Usuario pica carpeta catastrófica (`/`, `C:\Windows`) | **Alta** | Media | Denylist + warnlist (ADR-005) | - |
| R11 | `ANTHROPIC_API_KEY` seteado → factura por API en lugar de Max | **Alta** | Alta | `delete env.ANTHROPIC_API_KEY` + abort startup si detectado + warning en README | - |
| R12 | React 19 strict mode + xterm.js → doble mount rompe terminal | Media | Alta | Patrón documentado: lazy init + cleanup en useEffect | - |
| R13 | stream-json format cambia entre versiones del CLI | Media | Media | Pinning de versión de `claude` en README; parser tolerante (skip unknown events) | - |
| R14 | Custom agents con sprites malos corrompen el canvas | Baja | Baja | Magic bytes check + fallback a sprite default | - |
| R15 | Hot reload de custom agents dispara muchos `agents_updated` durante edición | Baja | Alta | Debounce `CUSTOM_AGENT_SCAN_DEBOUNCE_MS` | - |
| R16 | 10 sesiones concurrentes saturan CPU/RAM del usuario | Media | Baja | Límite `SESSION_MAX_CONCURRENT = 10`; monitoring básico | - |

### Top 5 riesgos (severidad × probabilidad)

1. **R1** — Flags del CLI (Alta/Alta).
2. **R11** — `ANTHROPIC_API_KEY` leak (Alta/Alta).
3. **R4** — Desacople de pixel-agents (Alta/Media).
4. **R2** — Perf del multiplexado WS (Alta/Media).
5. **R10** — Paths catastróficos (Alta/Media).

## 2. Spikes propuestos

Cada spike sigue el template `.claude/templates/technical-spike.md`.

---

### SPIKE-01: Throughput del multiplexado stream-json + pty(base64) en un WebSocket

**ID**: AB#TBD-S01
**Timebox**: 2 días
**Asignado a**: Tech Lead + Dev Backend
**Fecha límite**: Antes de Fase 3 (terminal embebida)

#### Pregunta
¿El overhead de base64 + JSON para multiplexar pty + stream-json en un único WS mantiene latencia p95 < `PTY_LATENCY_WARN_MS` (100 ms) con 3 sesiones y 3 pty activas?

#### Contexto
ADR-004 eligió Opción A (todo JSON) por simplicidad. Si la perf no alcanza, hay que migrar a Opción C (binary frames). Saber esto antes de tener el observer terminal + Bash tab escritos nos ahorra rework.

#### Hipótesis
1. Con 3 pty tipeando `yes | head -n 10000` en paralelo, p95 < 100ms.
2. Base64 overhead no domina: dominio es serialización JSON.
3. Si falla, pasar a binary frames rescata la perf sin rediseño.

#### Criterios de éxito
- [ ] Medición en entorno real (localhost, Chrome) con herramientas (DevTools Performance tab + backend pino logs).
- [ ] Decisión go/no-go vs fallback a binary frames.
- [ ] ADR-004 actualizado con datos reales.

#### Fuera de alcance
- Optimizar el renderer de xterm.js.
- Multi-cliente simultáneo.

#### Entregables
- PoC en branch `spike/ws-throughput`.
- Hoja con métricas (p50, p95, p99 por tipo de mensaje).
- Recomendación final.

---

### SPIKE-02: Flags reales de `claude` CLI headless en 2026-04

**ID**: AB#TBD-S02
**Timebox**: 1 día
**Asignado a**: Dev Backend
**Fecha límite**: Antes de Fase 1

#### Pregunta
¿Cuáles son las flags exactas del `claude` CLI instalado hoy para: modo headless, stream-json in/out, aprobación por tool, append-system-prompt, cwd? ¿El formato stream-json sigue siendo el descripto en `ARCHITECTURE.md` v0?

#### Contexto
`ARCHITECTURE.md` v0 fue escrito antes de empezar. El CLI evoluciona. Si `--permission-mode approval` ya no existe, o el stream-json cambió campos, tenemos que saberlo antes de Fase 1.

#### Hipótesis
1. `--print --output-format stream-json --input-format stream-json` sigue vigente.
2. Hay una flag de aprobación (nombre puede variar).
3. El formato stream-json expone `tool_use` y deja escribir respuesta por stdin.

#### Criterios de éxito
- [ ] Comando exacto documentado (reproducible).
- [ ] Capturar ejemplos reales de stream-json emitido.
- [ ] ADR si hay desviación del v0 (ADR-008 candidato).

#### Entregables
- Script `scripts/spike-02-probe.sh` que lanza `claude` en modo headless con un prompt mínimo y captura 30s de stream.
- Documento con eventos observados.

---

### SPIKE-03: `node-pty` en Windows con ConPTY — cobertura de apps TUI

**ID**: AB#TBD-S03
**Timebox**: 1 día
**Asignado a**: Dev Backend
**Fecha límite**: Antes de Fase 3

#### Pregunta
¿Qué apps interactivas funcionan bien en el Bash tab con `node-pty` + ConPTY en Windows 10/11? ¿Rompe alguna crítica para el flujo del usuario?

#### Contexto
El usuario es dev en Windows. Si `git log --paginate`, `npm test` con progress bars o `vim` rompen, la terminal pierde valor. Queremos saber antes de prometerlo.

#### Hipótesis
1. Comandos comunes (ls, git, npm, node) funcionan sin glitches.
2. Apps TUI full-screen (vim, htop) tienen glitches aceptables en ConPTY moderno.

#### Criterios de éxito
- [ ] Matriz de compat: comando → estado (OK / glitch menor / roto).
- [ ] Documentar workarounds (ej: usar `wsl` tab si está instalado).

#### Entregables
- Matriz en `docs/technical/terminal-integration.md` apéndice.

---

### SPIKE-04: Desacople de pixel-agents del API de VS Code

**ID**: AB#TBD-S04
**Timebox**: 2 días
**Asignado a**: Tech Lead + Dev Frontend
**Fecha límite**: Antes de Fase 1 (bloquea porting)

#### Pregunta
¿Cuál es el costo real de portar el render loop + sprites + NPC state machine de pixel-agents a nuestra app web standalone, sin `vscode.*`?

#### Contexto
ADR-001 adopta pixel-agents. ADR-003 opta por copia MIT. Si el 20% útil del código está demasiado acoplado al VS Code API, el ahorro estimado (2-4 semanas) es optimista y conviene replantear.

#### Hipótesis
1. El render loop de canvas no depende de `vscode`, solo de DOM + FS (para cargar sprites).
2. El sprite atlas se puede servir como static asset de Next.
3. NPC state machine es puro TypeScript.

#### Criterios de éxito
- [ ] Lista concreta de archivos a portar.
- [ ] Lista de archivos con dependencia a `vscode` + estrategia de sustitución.
- [ ] PoC: un NPC parado en canvas, leyendo un mock de estado, renderizando animación idle.
- [ ] Estimación realista (horas) para porting completo.

#### Entregables
- Branch `spike/pixel-agents-port`.
- Documento con lista de archivos + diffs de sustitución.

---

### SPIKE-05: Validación de path picker en 3 OS (opcional)

**ID**: AB#TBD-S05
**Timebox**: 0.5 días
**Asignado a**: Dev Frontend
**Fecha límite**: Antes de Fase 2

#### Pregunta
¿La File System Access API del browser alcanza para folder picker, o necesitamos un approach IPC con backend (Electron-like)?

#### Contexto
El picker del browser puede devolver handles con permisos limitados. Si no podemos obtener el path absoluto, el backend no sabe qué `cwd` usar.

#### Hipótesis
1. `showDirectoryPicker()` en Chrome/Edge devuelve handle, pero NO path absoluto → hay que fallback a input nativo que permita pegar path.
2. En MVP alcanza con un `<input type="text">` + autocomplete basado en `fs.readdirSync` del backend (tipo file explorer custom).

#### Criterios de éxito
- [ ] Decisión: File System Access API vs custom file explorer vs input con autocomplete.

#### Entregables
- PoC del picker elegido.

---

## 3. Cronograma sugerido de spikes

```
Semana 0 (pre-MVP):
  SPIKE-02  ██  (1d)  Dev Backend
  SPIKE-04  ████  (2d) Tech Lead + Dev Frontend
  SPIKE-05  █   (0.5d) Dev Frontend

Semana 1:
  SPIKE-01  ████  (2d) Tech Lead + Dev Backend
  SPIKE-03  ██  (1d)  Dev Backend
```

Spikes no se pisan — son secuenciales por dev donde comparten asignado.

## 4. Trigger de re-evaluación de ADRs

Si un spike invalida la premisa de un ADR, se abre un ADR nuevo (no se edita el anterior, se marca como "superseded by ADR-00X").

| Spike | Puede invalidar |
|---|---|
| SPIKE-01 | ADR-004 (elige Opción A; si falla, ADR-008 migrará a Opción C) |
| SPIKE-02 | ARCHITECTURE v0 § 11, `session-lifecycle.md` (nuevo ADR si hay divergencia) |
| SPIKE-04 | ADR-001 / ADR-003 (si el costo es inviable, reabrir Opción A "from scratch" con alcance reducido) |
