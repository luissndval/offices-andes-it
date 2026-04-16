# Preguntas abiertas — bloquean o informan implementación

Cada pregunta tiene: quién decide, impacto, opción default si no se responde.

## Producto / UX

### Q1 — ¿El usuario quiere poder reabrir un chat y recuperar la conversación anterior?

- **Decide**: PO / usuario.
- **Impacto**: si sí → necesitamos persistencia de mensajes (otra razón para SQLite o JSONs por sesión). Si no → cada apertura es limpia (v0 § 13 "fuera de scope").
- **Default**: cada apertura limpia (alineado a v0).
- **Bloquea**: arquitectura de storage. **No urgente hasta Fase 4**.

### Q2 — ¿Folder picker nativo del browser es suficiente, o queremos "recientes" / "favoritos"?

- **Decide**: PO.
- **Impacto**: UI del picker. Recientes requiere persistir lista de paths usados.
- **Default**: picker nativo + lista mínima de "últimos 5" en localStorage.
- **Bloquea**: diseño UX del modal de apertura.

### Q3 — ¿Cuántos tabs de terminal Bash por chat? (1, N, configurable)

- **Decide**: PO.
- **Impacto**: UI (si N, hay sub-tabs). Backend soporta N por `sessionId`.
- **Default**: 1 por chat (MVP). Agregar N en Fase 4 si hay feedback.
- **Bloquea**: UI de `ChatWindow`.

### Q4 — ¿El usuario puede editar el system prompt de un agente builtin en runtime?

- **Decide**: PO.
- **Impacto**: si sí → necesitamos editor en UI + override guardado en `characters.json` o archivo separado.
- **Default**: no en MVP. Para editar prompts, el usuario crea un custom agent (ADR-007).
- **Bloquea**: alcance de `CharacterEditor`.

### Q5 — ¿Hay un "modo focus" que minimice distracciones visuales del mapa?

- **Decide**: PO.
- **Impacto**: toggle simple (pausar animaciones + oscurecer mapa).
- **Default**: no en MVP.
- **Bloquea**: nada; feature futura.

## Seguridad

### Q6 — Warnlist de ADR-005: ¿cuáles paths adicionales deberían requerir confirmación?

- **Decide**: TL + PO.
- **Impacto**: falsos positivos (fricción) vs falsos negativos (riesgo).
- **Default**: lista propuesta en ADR-005 (paths fuera de $HOME, contiene `..`, depth < 3).
- **Bloquea**: implementación de `pathGuard.ts`.

### Q7 — ¿Permitimos tools `Bash`/`Write` sin aprobación con allow-list por agente?

- **Decide**: PO.
- **Impacto**: reduce fricción en tareas repetitivas (ej: QA corre tests), pero es superficie de riesgo.
- **Default**: aprobación total requerida en MVP (v0 § 12).
- **Bloquea**: nada para MVP. Feature de Fase 4+.

### Q8 — ¿Qué hacemos si el usuario arranca con `ANTHROPIC_API_KEY` seteada en su shell?

- **Decide**: TL.
- **Impacto**: o bloqueamos startup, o seguimos con warning y la deletamos del env del subprocess.
- **Default**: **continuar con warning ruidoso en consola + UI toast**, deletamos en el subprocess (heredado v0).
- **Bloquea**: comportamiento de bootstrap del backend. Decisión: mantener default.

## Técnicas

### Q9 — ¿Mantenemos mensajes del chat en memoria del backend durante reconnect, o el frontend reconstruye?

- **Decide**: TL.
- **Impacto**: memoria del backend, complejidad de rehidratación.
- **Default**: el **backend mantiene buffer de N últimos mensajes por sesión** (ej: 50). En reconnect el cliente pide `get_session_state` (no existe aún — agregar al protocolo si se confirma) y rehidrata. Si se perdieron mensajes "antiguos", se pierden (OK para MVP).
- **Bloquea**: agregar mensaje `get_session_state` + `session_state` al protocolo. **Debe decidirse antes de Fase 4**.

### Q10 — ¿Qué versión pineada de Claude Code CLI soportamos?

- **Decide**: TL, informado por SPIKE-02.
- **Impacto**: si el usuario updatea y cambia el stream-json, la app rompe.
- **Default**: documentar en README "probado con claude X.Y.Z". Detectar mismatch en startup emitiendo warning.
- **Bloquea**: README. **No urgente hasta release 0.1**.

### Q11 — ¿Dónde viven los system prompts de builtin agents?

- **Decide**: TL.
- **Impacto**: ubicación del archivo.
- **Opciones**:
  - A. En el projectPath del usuario: `<projectPath>/.claude/agents/<id>.md` (v0 default).
  - B. En el bundle del app: `backend/src/agents/builtin/<id>.md`.
  - C. Híbrido: busca en projectPath primero, fallback al bundle.
- **Default**: **Opción C** (híbrido). Permite al usuario tunear prompts per-proyecto; si no existe, usa el default del bundle.
- **Bloquea**: `AgentLoader`. Debe implementarse en Fase 1.

### Q12 — ¿El Bash tab hereda el env completo del usuario o filtrado?

- **Decide**: TL.
- **Impacto**: UX (variables del usuario disponibles) vs superficie (ANTHROPIC_API_KEY visible en terminal).
- **Default**: **env completo** del usuario. El Bash es "el shell del usuario en ese cwd". El filtro se aplica solo al subprocess de Claude Code (ADR-005).
- **Bloquea**: `PtyManager`. Decisión tomada: env completo.

### Q13 — ¿Soportamos workspaces VS Code-style (múltiples folders en una sesión)?

- **Decide**: PO.
- **Impacto**: cwd único por sesión vs N cwd.
- **Default**: **no** en MVP. Un chat = un folder.
- **Bloquea**: nada.

### Q14 — ¿Dónde y cómo se logean los audit events de path confirmations?

- **Decide**: TL.
- **Impacto**: compliance interno (si eventualmente se comparte la herramienta).
- **Default**: `backend/logs/audit.log` con rotación diaria, formato JSON line.
- **Bloquea**: `pathGuard.ts`.

### Q15 — ¿Custom agents pueden **ocultar** builtins (unset) o solo shadowear?

- **Decide**: PO / TL.
- **Impacto**: UX. Si pueden ocultar → usuario puede depurar la lista del dock.
- **Default**: solo shadow (ADR-007). Ocultar no se soporta en MVP.
- **Bloquea**: nada.

### Q16 — ¿Qué hacemos si el subprocess de Claude Code consume toda la RAM?

- **Decide**: TL.
- **Impacto**: estabilidad del host.
- **Default**: monitoreo básico con `process.resourceUsage()`; si `rss > RSS_WARN_MB` (ej: 2 GB) → log warning. No matamos automático en MVP.
- **Bloquea**: nada urgente.

## Operativas

### Q17 — ¿Creamos un instalador (script de bootstrap) o se clona y se hace `pnpm install` a mano?

- **Decide**: PO.
- **Impacto**: DX del primer uso.
- **Default**: clone + `pnpm install` + `pnpm dev` (heredado v0). Instalador = Fase 5+.
- **Bloquea**: nada.

### Q18 — ¿Se publica como tool interno? Si sí, ¿en qué repo, con qué license efectiva?

- **Decide**: PO.
- **Impacto**: visibility del código portado de pixel-agents. MIT ya permite cualquier uso.
- **Default**: repo privado inicialmente. Atribución MIT ya en orden (ADR-003).
- **Bloquea**: nada técnico.

## Resumen — bloqueantes reales antes de MVP

- **Q9** (reconnect state) — decidir antes de Fase 4.
- **Q11** (ubicación prompts builtin) — decidir antes de Fase 1. **Default ya propuesto**.
- **Q6** (warnlist de paths) — decidir antes de implementar `pathGuard.ts`. **Default ya propuesto**.
- Resto: defaults propuestos son razonables; avanzar salvo objeción.
