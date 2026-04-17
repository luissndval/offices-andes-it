# Handoff — Agent Workbench

Estado del proyecto al 2026-04-17, rama `claude/analyze-md-design-solution-nwMz5`.
Leelo cuando arranques una sesión de `claude` CLI para saber dónde estamos parados.

---

## Qué es esto

App local que visualiza a los agentes de Claude Code como NPCs de oficina
pixel-art. Cada chat = un personaje (Tech Lead, PO, QA, etc). Base técnica:
monorepo pnpm con backend Fastify + WebSocket y frontend Next.js.

- **Visión completa**: `docs/functional/epic.md`
- **Arquitectura**: `ARCHITECTURE.md` + `docs/technical/adr/`
- **Base open-source a adaptar**: `pablodelucca/pixel-agents` (MIT, ver `NOTICE.md`)

---

## Lo que ya está hecho

### Fase 0 — Bootstrap (commit `4bcd82a`)
- Monorepo pnpm workspaces (`frontend/`, `backend/`)
- Fastify en `:3001` con `/health`, `/agents`, `/ws`
- Next.js en `:3000` con WS ping/pong

### Fase 1 — Un chat funcional (commit `b61dc0e`)
- **Backend**:
  - `SessionManager` (máx 10 sesiones, valida agentId + projectPath)
  - `AgentSession` (spawn `claude` con flags validados en SPIKE-02)
  - `streamParser` (parsea stream-json → ServerMessages)
  - Protocolo WS completo: `open_session` / `send_message` / `close_session`
- **Frontend**: UI mínima con dropdown de agente, input de carpeta, selector
  de nivel de tools, streaming de respuestas, visualización de `tool_use`

### Documentación
- `docs/functional/`: epic + US-01 a US-09 con Gherkin + open-questions
- `docs/technical/adr/`: ADR-001 a ADR-007
- `docs/technical/spikes/SPIKE-02-claude-cli-flags.md` (flags validados)
- `docs/technical/spikes/SPIKE-04-desacople-pixel-agents.md` (análisis LOC)

---

## Cómo probar lo que hay (Fase 1)

### Prerequisitos
- Node 20+, pnpm
- `claude` CLI instalado y logueado con Max subscription
- **`ANTHROPIC_API_KEY` NO debe estar seteada** (el backend aborta si la detecta
  para evitar que cobre la API en lugar de usar Max)

### Pasos
```bash
# desde la raíz
pnpm install
pnpm dev        # levanta frontend :3000 + backend :3001
```

Abrir http://localhost:3000 y:
1. Verificar badge "backend: connected" (verde)
2. Seleccionar agente **Tech Lead**
3. Poner ruta de una carpeta local (ej. `/home/user/offices-andes-it`)
4. Tool level: **solo lectura** (default, más seguro para probar)
5. Click **Abrir chat**
6. Mandar un mensaje tipo "Explicame la estructura del proyecto"
7. Deberías ver: streaming de texto + burbujas de `tool_use` cuando lea archivos

### Troubleshooting
| Síntoma | Causa probable |
|---|---|
| Badge "disconnected" | backend no arrancó, revisá terminal de `pnpm dev` |
| `spawn claude ENOENT` | CLI no está en PATH → `which claude` |
| Backend aborta con mensaje sobre `ANTHROPIC_API_KEY` | `unset ANTHROPIC_API_KEY` y relanzar |
| `session_closed` inmediato | carpeta no existe, o falta `.claude/agents/<id>.md` en el proyecto **de este repo** (los prompts de agentes viven acá) |

---

## Lo que falta (próximas fases)

### Fase 2 — NPCs + mapa pixel-art
- Copiar renderer Canvas 2D de `pixel-agents` (`webview/` → `frontend/components/office/`)
- Portar assets (sprites 241KB, oficina tileada)
- Reemplazar el dropdown actual por click en NPC para abrir chat
- Ver `SPIKE-04` para el detalle file-by-file

### Fase 3 — Terminal embebida
- `xterm.js` + `node-pty` en el backend
- Un panel de terminal por sesión, compartiendo `cwd` con el agente

### Pendientes transversales
- **Customización de personajes**: nombre, ropa, color (ADR-005)
- **Drop-in de personajes custom**: carpeta `.claude/agents/` → NPC automático (ADR-006)
- **Multi-chat simultáneo**: la UI de Fase 1 solo soporta 1 sesión a la vez;
  el backend ya soporta hasta 10

---

## Decisiones importantes (contexto para no repetirlas)

1. **CLI en modo `--print` no permite aprobación humana por tool call**
   → usamos pre-autorización por sesión con 3 niveles: `read_only` / `edit` / `full`
   (ver ADR-004)

2. **`claude` CLI no emite evento `init` hasta recibir primer input por stdin**
   → `AgentSession` emite `session_opened` sincrónicamente tras el `spawn`,
   e ignora el `init` cuando llega después (ver `AgentSession.ts:73-84`)

3. **Canvas 2D, no WebGL/Phaser** — pixel-agents ya resolvió el render con
   Canvas simple; no sobre-ingenierizar (ADR-003)

4. **Fastify limpio, no reusar servidor de pixel-agents** — su server está
   acoplado al ciclo de vida de VS Code (ADR-002)

---

## Comandos útiles

```bash
# typecheck ambos paquetes
pnpm -r typecheck

# solo backend
pnpm --filter backend dev

# solo frontend
pnpm --filter frontend dev

# ver logs del backend con formato
pnpm --filter backend dev | pnpm dlx pino-pretty
```

---

## Cuando retomes con claude CLI

Prompt sugerido para arrancar:

> Leé `HANDOFF.md` y decime qué estás viendo. Probé Fase 1 y
> [funcionó / falló con X]. Quiero avanzar con [Fase 2 / fix de X / otra cosa].

El agente debería poder retomar el contexto leyendo este archivo +
`ARCHITECTURE.md` + los ADRs relevantes, sin necesidad de re-investigar.
