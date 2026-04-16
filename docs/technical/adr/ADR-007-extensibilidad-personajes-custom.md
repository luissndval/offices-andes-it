# ADR-007: Extensibilidad — agregar personajes custom (drop-in)

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

Requisito: el usuario puede agregar un agente **que no existe en el bundle**. Debe ser drop-in — tirar archivos en una carpeta y que aparezcan en el dock.

Necesidades:
1. **System prompt propio** (archivo `.md`, similar a `.claude/agents/*.md`).
2. **Sprite** (imagen PNG u alias a un sprite ya incluido).
3. **Metadata**: displayName, color, descripción corta, modelo (opcional).
4. Que el backend lo **cargue automáticamente** al arrancar o bajo demanda sin tocar código.

Constantes (ver `character-customization.md`):
- `CUSTOM_AGENT_DIR = "~/.agent-workbench/agents"`
- `CUSTOM_AGENT_ID_REGEX = /^[a-z0-9-]{2,32}$/`
- `CUSTOM_AGENT_SPRITE_MAX_BYTES = 524288` (512 KB)
- `CUSTOM_AGENT_PROMPT_MAX_BYTES = 65536` (64 KB)
- `CUSTOM_AGENT_SCAN_INTERVAL_MS = 5000` (watch mode)

## Opciones consideradas

### Opción A: UI wizard con upload de archivos, guarda en DB/JSON

**Pros**
- UX guiada, menos chance de romper.
- Valida en tiempo real.
- No pide al usuario saber de filesystem.

**Contras**
- Flujo largo de implementar.
- Usuario no puede versionarlo en git ni compartirlo.
- Para power users (quienes realmente agregan agentes) es más lento que drag-drop.

### Opción B: Carpeta drop-in `~/.agent-workbench/agents/<agent-id>/` con convención

**Pros**
- Cero UI para el caso básico.
- Versionable en git (carpeta de dotfiles).
- Compartible: zip del folder, listo.
- Coherente con `.claude/agents/` del proyecto target.
- Escala a N agentes sin tocar código.

**Contras**
- Usuario debe conocer la convención (mitigado con docs + script `init-agent`).
- Sin wizard, errores de formato viven en el archivo hasta que el backend los vea.

### Opción C: Híbrido — drop-in + UI de "nuevo agente" que genera la estructura

**Pros**
- Lo mejor de ambos: power users drop-in, newbies UI.
- Una sola fuente de verdad (la carpeta).
- UI es puro helper de creación.

**Contras**
- Dos paths de entrada a mantener.
- UI requiere file-picker y PNG preview.

## Decisión

**Opción B** para MVP, con camino claro a **Opción C** en Fase 4+ (quality of life).

Para MVP, solo carpeta drop-in con validación estricta al cargar. Documentación con ejemplo completo.

Estructura:

```
~/.agent-workbench/
├── characters.json                   # ADR-006
└── agents/
    ├── data-scientist/
    │   ├── agent.yaml                # metadata (obligatorio)
    │   ├── prompt.md                 # system prompt (obligatorio)
    │   └── sprite.png                # opcional; si falta, usa sprite default
    └── security-reviewer/
        ├── agent.yaml
        └── prompt.md
```

`agent.yaml` (schema):

```yaml
id: data-scientist             # CUSTOM_AGENT_ID_REGEX
displayName: Data Scientist
description: Análisis de datos y ML
color: "#4CAF50"               # #RRGGBB
spriteVariant: custom          # o clave de atlas builtin
model: null                    # opcional, override
```

Validación al cargar:
1. `id` matchea `CUSTOM_AGENT_ID_REGEX`.
2. `prompt.md` existe y pesa ≤ `CUSTOM_AGENT_PROMPT_MAX_BYTES`.
3. `sprite.png` (si está) pesa ≤ `CUSTOM_AGENT_SPRITE_MAX_BYTES` y es PNG real (magic bytes).
4. `displayName` 1-32 chars, sin control chars.
5. `color` matchea `/^#[0-9a-fA-F]{6}$/`.
6. No colisiona con `id` builtin — si colisiona, el custom **gana** con warning de "override".

Backend watcha la carpeta (chokidar) con debounce `CUSTOM_AGENT_SCAN_INTERVAL_MS`. Cambios emiten `agents_updated` al frontend (ver `websocket-protocol.md`).

## Consecuencias

### Positivas
- Cero código para agregar un agente nuevo.
- Portable y compartible (tarball de la carpeta).
- Coherente con el patrón de `.claude/agents/` que el usuario ya conoce.
- Load-on-start + watch → hot-reload sin reiniciar app.

### Negativas / Trade-offs aceptados
- El usuario tiene que aprender el formato. Mitigado con template oficial + error messages claros.
- Sprites custom sin convención de frames pueden romper animación → MVP solo permite un frame estático, animaciones requieren sprite de atlas builtin (spriteVariant != "custom").
- Posible ataque: PNG malicioso / prompt injection en `prompt.md`. Prompt injection aplica también a builtins → aceptamos el riesgo (local, single-user). PNG malicioso mitigado con validación de magic bytes + límite de size.
- Watch de filesystem consume un poco más de CPU (despreciable con chokidar).

### Acciones derivadas
- [ ] Schema zod para `agent.yaml` en `backend/src/agents/customAgentSchema.ts`.
- [ ] `CustomAgentLoader` con watch + debounce.
- [ ] Mensajes WS: `agents_updated` (payload: lista completa, builtin + custom).
- [ ] Merge order: builtins de `frontend/lib/agents.ts` + custom de `~/.agent-workbench/agents/`. Customs pueden shadowear builtins con warning.
- [ ] Sprite loader fallback: si falta `sprite.png`, usar sprite default tintado con `color`.
- [ ] Endpoint `POST /agents/init` (o comando CLI `agent-workbench init-agent <id>`) que crea el scaffolding para el usuario.
- [ ] README: sección "Cómo agregar un agente custom" con ejemplo completo paso a paso.
- [ ] Tests: custom agent con formato inválido → warning en log + skip, la app sigue.
- [ ] Fase 4+: UI de "nuevo agente" que genera esta estructura (Opción C).

## Referencias
- `docs/technical/character-customization.md`
- ADR-006
- `.claude/agents/` del proyecto target (convención inspiradora)
