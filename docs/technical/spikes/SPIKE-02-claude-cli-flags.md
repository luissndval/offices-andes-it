# Spike: Validar flags reales del CLI `claude` para spawn headless con streaming bidireccional

**ID**: SPIKE-02
**Timebox**: 1 día
**Asignado a**: Dev Backend
**Fecha límite**: 2026-04-16
**CLI validado**: claude 2.1.112 (Claude Code), entorno Linux, usuario root

---

## Pregunta a responder

¿Los flags asumidos en `session-lifecycle.md` y `ARCHITECTURE.md § 11` para spawnear Claude Code en modo headless con streaming bidireccional existen y funcionan como se describió?

## Contexto

El backend de Agent Workbench necesita spawnear `claude` como subprocess headless. Los documentos de diseño (`session-lifecycle.md §3.2`, `ARCHITECTURE.md §11`) asumieron un comando con flags específicos sin haberlos validado contra la versión instalada. SPIKE-02 fue abierto en `risks-and-spikes.md` precisamente para validar esto antes de la implementación de Fase 1.

## Hipótesis a evaluar

1. Los flags `--print`, `--output-format stream-json`, `--input-format stream-json`, `--append-system-prompt`, `--permission-mode approval`, `--cwd` existen con esos nombres exactos.
2. El modelo de aprobación de tools vía stdin (escribir tool_result al stdin del proceso) funciona en `--print` mode.
3. Si `ANTHROPIC_API_KEY` está seteada, el CLI la usa en lugar de OAuth.

---

## Resumen ejecutivo

- `--print`, `--output-format stream-json`, `--input-format stream-json`, `--append-system-prompt` **existen y funcionan**. Sin embargo, `--output-format stream-json` requiere `--verbose` de forma obligatoria, flag no documentada en el diseño.
- `--cwd` **no existe**. El proceso hereda el cwd del proceso padre (Node). La alternativa es pasar `cwd` en las opciones de `spawn()` de Node.
- `--permission-mode approval` **no existe**. Los valores reales son: `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, `plan`. Ninguno implementa "pausa y espera aprobación humana via stdin" en modo `--print`.
- **El modelo de aprobación human-in-the-loop vía stdin es incorrecto**: en `--print` mode el CLI maneja permisos internamente (auto-rechaza o auto-aprueba según el modo). No expone ningún mecanismo de pausa/respuesta por stdin.
- `ANTHROPIC_API_KEY=""` o no seteada resulta en `apiKeySource: none` (OAuth). Un valor no vacío resulta en `apiKeySource: ANTHROPIC_API_KEY` pero en la práctica el CLI 2.1.112 parece validar el formato y caer a OAuth si el valor es inválido; **no se debe confiar en este comportamiento** — en producción hacer `delete env.ANTHROPIC_API_KEY`.
- Múltiples procesos en paralelo con la misma auth **no se bloquean**; se validó con 3 procesos concurrentes sin errores.
- Existen `--system-prompt-file` y `--append-system-prompt-file` como alternativa superior a `--append-system-prompt "$(cat file.md)"` para system prompts grandes.

---

## Flags reales confirmados

### Tabla de flags relevantes (claude 2.1.112)

| Flag | Existe | Propósito | Formato / Notas |
|---|---|---|---|
| `-p` / `--print` | Si | Modo no interactivo; lee stdin, imprime a stdout y sale | `claude --print` o `-p` |
| `--output-format` | Si | Formato de salida | Valores: `text` (default), `json`, `stream-json`. **Requiere `--verbose` cuando es `stream-json`** |
| `--input-format` | Si | Formato de entrada por stdin | Valores: `text` (default), `stream-json`. Solo funciona con `--print`. **Requiere `--output-format stream-json`** |
| `--append-system-prompt` | Si | Agrega texto al system prompt por defecto | `--append-system-prompt "<texto>"` |
| `--append-system-prompt-file` | Si | Igual pero desde archivo. **Preferido para prompts grandes** | `--append-system-prompt-file /path/to/prompt.md` |
| `--system-prompt` | Si | Reemplaza el system prompt completo | `--system-prompt "<texto>"` |
| `--system-prompt-file` | Si | Igual pero desde archivo | `--system-prompt-file /path/to/prompt.md` |
| `--verbose` | Si | Modo verboso; **obligatorio con `--output-format stream-json`** | `--verbose` (sin valor) |
| `--permission-mode` | Si | Modo de permisos de tools | Valores: `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, `plan`. **`approval` no existe** |
| `--allowed-tools` | Si | Lista de tools pre-autorizadas sin pedir permiso | `--allowed-tools "Read Glob Grep"` o `--allowed-tools Read,Glob` |
| `--disallowed-tools` | Si | Lista de tools bloqueadas explícitamente | Mismo formato que `--allowed-tools` |
| `--add-dir` | Si | Directorios adicionales que el agente puede acceder | `--add-dir /path/to/dir` |
| `--cwd` | **No existe** | Flag para cambiar el cwd del proceso | **Workaround**: usar `cwd` en las opciones de `child_process.spawn()` / `execa()` |
| `--include-partial-messages` | Si | Emite eventos `stream_event` con deltas parciales | Solo con `--print --output-format stream-json` |
| `--include-hook-events` | Si | Incluye eventos de hooks en el stream | Solo con `--output-format stream-json` |
| `--no-session-persistence` | Si | No guarda la sesión en disco | Útil en headless para no contaminar `~/.claude/` con sesiones |
| `--model` | Si | Seleccionar modelo específico | `--model sonnet` o `--model claude-sonnet-4-6` |
| `--dangerously-skip-permissions` | Si | Bypass total de permisos | **Bloqueado si el proceso corre como root**. No usar en prod. |
| `--bare` | Si | Modo mínimo; solo autenticación via API key o `apiKeyHelper`. OAuth deshabilitado | Para entornos sin keychain |

### Flags asumidos que NO existen

| Flag asumido | Estado | Alternativa confirmada |
|---|---|---|
| `--cwd <path>` | No existe | Pasar `{ cwd: projectPath }` en `execa()` / `spawn()` |
| `--permission-mode approval` | El valor `approval` no es válido | Ver sección "Aprobaciones" abajo |

---

## Formato real del stream-json

### Comando mínimo funcional

```bash
claude \
  --print \
  --verbose \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt-file /path/to/agent.md \
  --permission-mode dontAsk \
  --allowed-tools "Read,Glob,Grep,Bash"
# cwd se pasa en spawn options, no como flag
```

### Secuencia de eventos de salida (una línea JSON por evento)

**Evento 1 — init** (siempre el primero):
```json
{
  "type": "system",
  "subtype": "init",
  "cwd": "/home/user/project",
  "session_id": "<uuid>",
  "tools": ["Task","Bash","Edit","Glob","Grep","Read","Write","WebFetch","WebSearch"],
  "model": "claude-sonnet-4-6",
  "permissionMode": "dontAsk",
  "apiKeySource": "none",
  "claude_code_version": "2.1.112"
}
```

**Evento 2 — assistant con thinking** (cuando el modelo piensa antes de responder):
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6",
    "id": "<msg_id>",
    "type": "message",
    "role": "assistant",
    "content": [{ "type": "thinking", "thinking": "...", "signature": "..." }],
    "stop_reason": null,
    "usage": { "input_tokens": 3, "cache_creation_input_tokens": 2133, "output_tokens": 1 }
  },
  "session_id": "<uuid>",
  "uuid": "<uuid>"
}
```

**Evento 3 — assistant con tool_use**:
```json
{
  "type": "assistant",
  "message": {
    "model": "claude-sonnet-4-6",
    "id": "<msg_id>",
    "type": "message",
    "role": "assistant",
    "content": [{
      "type": "tool_use",
      "id": "toolu_01QZRSer...",
      "name": "Read",
      "input": { "file_path": "/path/to/file.txt" },
      "caller": { "type": "direct" }
    }],
    "stop_reason": null
  },
  "session_id": "<uuid>",
  "uuid": "<uuid>"
}
```

**Evento 4 — user con tool_result** (generado automáticamente por el CLI tras ejecutar la tool):
```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [{
      "tool_use_id": "toolu_01QZRSer...",
      "type": "tool_result",
      "content": "1\thello from spike-02\n2\t"
    }]
  },
  "timestamp": "2026-04-16T22:44:35.440Z",
  "tool_use_result": {
    "type": "text",
    "file": {
      "filePath": "/path/to/file.txt",
      "content": "hello from spike-02\n",
      "numLines": 2
    }
  },
  "session_id": "<uuid>",
  "uuid": "<uuid>"
}
```

**Evento 5 — assistant con texto final**:
```json
{
  "type": "assistant",
  "message": {
    "content": [{ "type": "text", "text": "El contenido del archivo es: ..." }],
    "stop_reason": null
  }
}
```

**Evento 6 — result** (siempre el último, indica fin de turno):
```json
{
  "type": "result",
  "subtype": "success",
  "is_error": false,
  "num_turns": 2,
  "result": "El contenido del archivo es: ...",
  "stop_reason": "end_turn",
  "total_cost_usd": 0.018879,
  "session_id": "<uuid>"
}
```

### Eventos adicionales con `--include-partial-messages`

Con este flag se agregan eventos `stream_event` que envuelven los eventos SSE de la API:

```json
{ "type": "stream_event", "event": { "type": "message_start", "message": {...} } }
{ "type": "stream_event", "event": { "type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""} } }
{ "type": "stream_event", "event": { "type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "hola"} } }
{ "type": "stream_event", "event": { "type": "content_block_stop", "index": 0 } }
{ "type": "stream_event", "event": { "type": "message_delta", "delta": {"stop_reason": "end_turn"} } }
{ "type": "stream_event", "event": { "type": "message_stop" } }
```

### Formato de input por stdin (`--input-format stream-json`)

Una línea JSON por mensaje. Formato mínimo confirmado:

```json
{"type":"user","message":{"role":"user","content":"texto del mensaje"}}
```

Multi-turn: múltiples líneas; el proceso procesa cada una como un turno nuevo. Ambas líneas enviadas antes que el proceso lea generan dos turnos secuenciales (el proceso no espera respuesta antes de leer la siguiente).

**Nota crítica**: `--input-format stream-json` solo funciona si también se usa `--output-format stream-json` (el CLI lo valida y falla con código 1 si no).

---

## Aprobaciones de tools en modo headless — hallazgo crítico

### Lo que asumía el diseño

`session-lifecycle.md §5.1` describe un flujo donde:
1. El backend detecta `tool_use` en el stream.
2. Pausa esperando respuesta del usuario.
3. Escribe al stdin del subprocess la decisión en formato stream-json.

Este modelo es **incorrecto para `--print` mode**.

### Comportamiento real (validado)

En `--print` mode, el CLI **no pausa esperando stdin para aprobaciones**. El manejo de permisos es interno al CLI, controlado por `--permission-mode`:

| Modo | Comportamiento con tools |
|---|---|
| `default` | Auto-rechaza cualquier tool fuera del directorio de trabajo actual. Emite `tool_result` con error inmediatamente. |
| `acceptEdits` | Idéntico a `default` en `--print` mode (auto-rechaza Read de paths externos). |
| `dontAsk` | Auto-aprueba tools dentro del directorio de trabajo. Rechaza paths externos con mensaje explícito. |
| `auto` | Auto-aprueba todas las tools sin pedir confirmación. |
| `bypassPermissions` | Bypass total. **Bloqueado como root** (falla con error de seguridad). |
| `plan` | Modo de planificación; no ejecuta tools. |

**El evento `user/tool_result` en el stream de salida** es el resultado de la ejecución ya completada (o el mensaje de rechazo automático). No es un evento de "solicitud de aprobación pendiente".

### Alternativas reales para human-in-the-loop

**Opción A — Pre-autorizar tools por lista (recomendada para MVP)**

```bash
claude --print --verbose --output-format stream-json \
  --permission-mode dontAsk \
  --allowed-tools "Read,Glob,Grep"
```

El usuario aprueba en el frontend qué tools puede usar el agente al abrir la sesión. No hay aprobación por invocación.

**Opción B — Hooks (PreToolUse)**

El CLI soporta hooks definidos en `.claude/settings.json`. Un hook `PreToolUse` puede interceptar cada invocación de tool. Sin embargo, el hook es un script externo que devuelve allow/deny; no hay mecanismo de comunicación de vuelta hacia la UI en tiempo real desde el hook en `--print` mode. Complejidad alta, no recomendado para MVP.

**Opción C — MCP Server con tool proxy**

Un servidor MCP propio podría mediar las tools, exponiéndolas bajo un wrapper que consulta la UI antes de ejecutar. Complejidad muy alta; fuera de scope MVP.

**Decisión recomendada para Fase 1**: usar Opción A. El usuario selecciona el conjunto de tools permitidas al abrir la sesión. Se expone al frontend como un "nivel de permisos" (solo lectura / lectura + edición / todas).

---

## Manejo de `ANTHROPIC_API_KEY`

| Escenario | `apiKeySource` en init | Resultado |
|---|---|---|
| Variable no seteada | `"none"` | Usa OAuth (Claude Max). Funciona. |
| `ANTHROPIC_API_KEY=""` (vacía) | `"none"` | Trata igual que no seteada. Usa OAuth. |
| `ANTHROPIC_API_KEY="sk-ant-fake-..."` | `"ANTHROPIC_API_KEY"` | En 2.1.112 el CLI parece validar el formato y caer a OAuth si el valor es inválido. **No confiar en este comportamiento**. |

**Regla de implementación confirmada**: hacer `delete env.ANTHROPIC_API_KEY` en el env filtrado antes de `spawn()`. Esto garantiza `apiKeySource: none` y que el CLI use la sesión OAuth del usuario.

---

## Concurrencia

Validado: 3 procesos en paralelo con la misma auth OAuth funcionan sin bloqueo ni errores. Los procesos son independientes y no se interfieren.

---

## Gaps vs hipótesis del ADR-005 y session-lifecycle.md

| Documento | Hipótesis | Realidad | Severidad |
|---|---|---|---|
| `session-lifecycle.md §3.2` | Flag `--cwd "$PROJECT_PATH"` | No existe. | **Alta** — requiere cambio en el spawn command |
| `session-lifecycle.md §3.2` | `--permission-mode approval` | Valor `approval` no existe. | **Alta** — requiere redefinir el modelo de aprobaciones |
| `session-lifecycle.md §5.1` | Escribir al stdin la decisión de aprobación | No funciona en `--print` mode. | **Crítica** — el flujo completo de aprobación es incorrecto |
| `session-lifecycle.md §3.2` | `--output-format stream-json` (solo) | Requiere también `--verbose` | **Media** — fix de una línea en el spawn command |
| `session-lifecycle.md §4.1` | Eventos `message_start`, `content_block_delta`, `message_stop` | Esos son eventos de `stream_event` wrapper (con `--include-partial-messages`). Sin ese flag, los eventos son `assistant`, `user`, `result`. | **Media** — parser debe soportar la estructura real |
| `ARCHITECTURE.md §11` | System prompt via `$(cat file.md)` en el argumento | Funciona pero `--append-system-prompt-file` es superior | **Baja** — mejora, no bloqueante |

---

## Recomendaciones de cambios (NO editar los documentos — solo proponer)

### `session-lifecycle.md §3.2` — Comando de spawn

Reemplazar:
```bash
claude \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt "$SYSTEM_PROMPT" \
  --permission-mode approval \
  --cwd "$PROJECT_PATH"
```

Por:
```bash
claude \
  --print \
  --verbose \
  --output-format stream-json \
  --input-format stream-json \
  --append-system-prompt-file "$SYSTEM_PROMPT_FILE" \
  --permission-mode dontAsk \
  --allowed-tools "$ALLOWED_TOOLS_LIST" \
  --no-session-persistence
# cwd: pasar en opciones de spawn(), no como flag
```

Y en el código Node:
```typescript
const proc = execa('claude', [...args], {
  cwd: projectPath,  // <-- aquí va el cwd
  env: filteredEnv,
});
```

### `session-lifecycle.md §4.1` — Parser de eventos

Actualizar la tabla de eventos. Los eventos del stream sin `--include-partial-messages` son:

| Tipo de evento | Descripción |
|---|---|
| `{"type":"system","subtype":"init"}` | Primer evento, contiene session_id, tools, model, permissionMode |
| `{"type":"assistant"}` | Mensaje del asistente; `message.content` puede contener `thinking`, `text`, o `tool_use` |
| `{"type":"user"}` | Resultado de ejecución de tool (auto-generado por el CLI); `message.content[].type == "tool_result"` |
| `{"type":"result"}` | Fin de turno; contiene `result` (texto final), `stop_reason`, `is_error`, `total_cost_usd` |
| `{"type":"rate_limit_event"}` | Información de rate limit; puede ignorarse para el flujo principal |
| `{"type":"system","subtype":"hook_started/hook_response"}` | Eventos de lifecycle hooks; ignorar en parser principal |

Si se agrega `--include-partial-messages`, aparecen además eventos `{"type":"stream_event","event":{...}}` que contienen los deltas `message_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop` de la API.

### `session-lifecycle.md §5` — Rediseño del flujo de aprobaciones

El estado `waiting_tool_approval` y el flujo de stdin-approval deben eliminarse. Propuesta de rediseño:

1. Las tools permitidas se definen al momento de `open_session` (elegidas por el usuario en el frontend o fijadas por el agente).
2. El backend traduce esa lista a `--allowed-tools` y `--permission-mode dontAsk`.
3. No hay estado `waiting_tool_approval`. El evento `user/tool_result` en el stream es informativo: el frontend lo muestra como "el agente usó la herramienta X".
4. Para Fase 2: si se quiere granularidad por invocación, evaluar la Opción B (hooks) como spike separado.

### `ADR-005` — Sección de consecuencias

Agregar en "Acciones derivadas":
- Spawn con `{ cwd: projectPath }` en `execa()`, no con flag `--cwd`.
- `--permission-mode` a definir por agente (configuración en el descriptor del agente). Default: `dontAsk` + `--allowed-tools` según perfil del agente.
- Eliminar la arquitectura de aprobación via stdin; reemplazar por modelo de pre-autorización por sesión.

---

## Riesgos residuales

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El comportamiento de `--permission-mode dontAsk` con `--allowed-tools` puede diferir para tools como `Bash` con comandos destructivos | Media | Alta | Validar con un PoC específico para Bash tool en SPIKE-04 |
| El fake-key fallback a OAuth (apiKeySource=ANTHROPIC_API_KEY pero call exitoso) puede cambiar en futuras versiones del CLI | Baja | Alta | Ya mitigado: delete env siempre |
| `--include-partial-messages` agrega ~50% más eventos; puede impactar el buffer de backpressure | Baja | Media | No usar `--include-partial-messages` en el spawn de producción; solo con `--verbose` y `--output-format stream-json` |
| Running as root bloquea `bypassPermissions` y `dangerously-skip-permissions` | Alta (en Docker root) | Media | Confirmar que el backend de producción NO corra como root; si corre en Docker, usar `USER` directive |
| Comportamiento en Windows (ConPTY, rutas con espacios en `--append-system-prompt-file`) | **Pendiente de validar en Windows** | Alta | Reservar tiempo antes de Fase 1 en Windows |
| Multi-turn con `--input-format stream-json` requiere que ambas líneas lleguen al stdin antes de que el proceso las consuma; puede haber race conditions | Media | Media | Verificar con el modelo de streaming en el backend real (readline sobre stdout del proceso) |

---

## Criterios de éxito del spike

- [x] Flags reales documentados con evidencia ejecutable
- [x] Gaps vs hipótesis identificados y clasificados por severidad
- [x] Ejemplos reales de stream-json incluidos
- [x] Recomendaciones concretas de cambio propuestas
- [x] Riesgos residuales listados

## Fuera de alcance

- Validación en Windows / macOS (pendiente)
- Implementación de hooks para aprobación granular (SPIKE futuro)
- Benchmark de throughput con múltiples sesiones concurrentes (>3)

---

## Próximos pasos

- [ ] Tech Lead actualiza `session-lifecycle.md §3.2` y `§5` con el nuevo modelo de permisos.
- [ ] Tech Lead actualiza `ADR-005` sección de consecuencias (cwd via spawn options, permission model).
- [ ] US de Fase 1 actualiza el spawn command y elimina el estado `waiting_tool_approval`.
- [ ] SPIKE-04 (Bash tool sandboxing) debe validar comportamiento de `--permission-mode dontAsk` con `--allowed-tools Bash`.
- [ ] Validar comportamiento en Windows antes de que el usuario final use la app (paths con espacios, ConPTY).
