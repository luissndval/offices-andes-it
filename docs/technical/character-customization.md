# Character Customization — Schema, API, persistencia

**Referencias**: ADR-006 (persistencia), ADR-007 (custom agents), `websocket-protocol.md`.

## 1. Alcance

El usuario puede:

1. Customizar agentes **builtin** (nombre visible, color, sprite variant). La definición base sigue viniendo del bundle.
2. Agregar agentes **custom** drop-in (ver ADR-007) con su propio system prompt y sprite.
3. Resetear un agente a sus defaults.

**Scope**: por instalación del usuario. No hay perfiles múltiples, no hay sync cross-device.

## 2. Constantes

```typescript
export const CHARACTER_NAME_MAX_LEN = 32;
export const CHARACTER_NAME_MIN_LEN = 1;
export const CHARACTER_COLOR_HEX_LEN = 7;           // "#RRGGBB"
export const CHARACTER_COLOR_HEX_REGEX = /^#[0-9a-fA-F]{6}$/;
export const CHARACTER_CUSTOMIZATION_SCHEMA_VERSION = 1;

export const CUSTOM_AGENT_DIR_NAME = ".agent-workbench";
export const CUSTOM_AGENT_ID_REGEX = /^[a-z0-9-]{2,32}$/;
export const CUSTOM_AGENT_SPRITE_MAX_BYTES = 524288;       // 512 KB
export const CUSTOM_AGENT_PROMPT_MAX_BYTES = 65536;        // 64 KB
export const CUSTOM_AGENT_SCAN_INTERVAL_MS = 5000;
export const CUSTOM_AGENT_SCAN_DEBOUNCE_MS = 1500;

export const SPRITE_VARIANT_DEFAULT = "default";
```

## 3. Schema persistido

**Archivo**: `~/.agent-workbench/characters.json`

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-04-16T22:10:00.000Z",
  "characters": {
    "tech-lead": {
      "agentId": "tech-lead",
      "displayName": "Arqui Pablo",
      "colorHex": "#7F77DD",
      "spriteVariant": "glasses",
      "updatedAt": "2026-04-16T22:10:00.000Z"
    }
  }
}
```

### 3.1 Reglas

- `characters` puede tener entries solo para agentes customizados. Los no listados usan defaults del registry.
- Para agentes custom (ADR-007): la override en `characters.json` toma prioridad sobre la `agent.yaml`. Ambas coexisten: `agent.yaml` define el default de un agente custom, `characters.json` define override por usuario.
- `schemaVersion` permite migraciones.

### 3.2 Migraciones

- Al cargar: si `schemaVersion < CHARACTER_CUSTOMIZATION_SCHEMA_VERSION` → aplicar migraciones en cadena.
- Migraciones en `backend/src/characters/migrations/v{n}-to-v{n+1}.ts`.
- Si el archivo no existe: crear con defaults.
- Si el archivo es corrupto: renombrar a `characters.corrupt.<ISO>.json`, arrancar con defaults, log error.

## 4. Custom agents (ADR-007)

**Directorio**: `~/.agent-workbench/agents/<agentId>/`

```
agents/data-scientist/
├── agent.yaml          # metadata (obligatorio)
├── prompt.md           # system prompt (obligatorio)
└── sprite.png          # opcional, 64x64 PNG
```

### 4.1 `agent.yaml`

```yaml
id: data-scientist
displayName: Data Scientist
description: Análisis de datos y ML
color: "#4CAF50"
spriteVariant: custom
model: null
```

Zod schema:

```typescript
const customAgentYamlSchema = z.object({
  id: z.string().regex(CUSTOM_AGENT_ID_REGEX),
  displayName: z.string().min(CHARACTER_NAME_MIN_LEN).max(CHARACTER_NAME_MAX_LEN),
  description: z.string().max(200),
  color: z.string().regex(CHARACTER_COLOR_HEX_REGEX),
  spriteVariant: z.string().min(1).max(32),
  model: z.string().nullable().optional(),
});
```

### 4.2 Validaciones al cargar

1. `agent.yaml` parsea y pasa el schema.
2. `prompt.md` existe y `stat.size <= CUSTOM_AGENT_PROMPT_MAX_BYTES`.
3. Si `sprite.png` existe:
   - `stat.size <= CUSTOM_AGENT_SPRITE_MAX_BYTES`.
   - Primeros 8 bytes = `89 50 4E 47 0D 0A 1A 0A` (PNG magic).
   - `spriteVariant` en `agent.yaml` debe ser `"custom"`.
4. `id` del yaml **debe coincidir** con el nombre del directorio. Si no → log error + skip.
5. Shadow de builtin: si `id` colisiona → el custom gana con log warning.

### 4.3 Hot reload

- `chokidar` watcha `~/.agent-workbench/agents/` recursivo.
- Eventos (`add`, `change`, `unlink`) → debounce `CUSTOM_AGENT_SCAN_DEBOUNCE_MS` → rescan completo.
- Broadcast `agents_updated` al frontend con la lista consolidada.

## 5. Sprite variants

### 5.1 Builtin atlas

Sprites vienen como atlas PNG + JSON con frames. Ejemplo:

```json
{
  "variants": {
    "default":       { "x":0,   "y":0,  "w":32, "h":32, "frames": 4 },
    "glasses":       { "x":128, "y":0,  "w":32, "h":32, "frames": 4 },
    "formal":        { "x":0,   "y":32, "w":32, "h":32, "frames": 4 },
    "casual":        { "x":128, "y":32, "w":32, "h":32, "frames": 4 }
  }
}
```

Origen: portado de pixel-agents (ADR-003).

### 5.2 Sprite custom

- Un único frame estático de 64×64 máximo.
- Se tinta con `colorHex` aplicando color overlay multiplicativo.
- No soporta animaciones de estado (idle/thinking/tool_use usan el mismo frame con burbuja encima).

## 6. API (sobre WebSocket, ver `websocket-protocol.md`)

### 6.1 Leer

```
C → S : { type: "get_characters" }
S → C : { type: "characters", byAgentId: {...}, schemaVersion: 1 }
```

### 6.2 Actualizar

```
C → S : {
  type: "update_character",
  agentId: "tech-lead",
  patch: { displayName: "Arqui", colorHex: "#FF0000" }
}
S → C : {
  type: "character_updated",
  agentId: "tech-lead",
  character: { ...merged }
}
```

Backend:

1. Valida `patch` con zod.
2. Lee `characters.json` (cache in-memory).
3. Merge: `{ ...default, ...existing, ...patch, updatedAt: now }`.
4. Escribe **atómicamente** (`tmp + rename`).
5. Broadcast `character_updated`.

### 6.3 Reset

```
C → S : { type: "reset_character", agentId: "tech-lead" }
S → C : { type: "character_updated", agentId: "tech-lead", character: <defaults> }
```

Backend: borra la entry en `characters.json`, reescribe atómico, broadcast.

### 6.4 Listado de agentes (con customs)

```
C → S : { type: "get_agents" }
S → C : {
  type: "agents_updated",
  agents: [AgentDefinition, ...],
  builtinCount: 8,
  customCount: 2
}
```

`AgentDefinition` (ver `websocket-protocol.md`) combina:
- Datos base (builtin del bundle, o `agent.yaml` del custom).
- Override de `characters.json` aplicado encima.

## 7. Frontend — Zustand store

```typescript
type CharactersStore = {
  byAgentId: Record<AgentId, CharacterCustomization>;
  schemaVersion: number;
  loading: boolean;
  // actions
  hydrate: () => void;                   // dispara get_characters
  update: (agentId, patch) => void;      // optimistic + WS
  reset: (agentId) => void;
};
```

- Optimistic update: aplica el patch localmente, rollback si el `character_updated` no llega en 5s.
- Hidratación al primer WS connect.

## 8. UI (overview)

- **CharacterEditor modal** — se abre con click en un NPC del mapa o ícono de "editar" en el agente del dock.
- Campos:
  - Display name (text, max 32).
  - Color (color picker + input hex).
  - Sprite variant (thumbnails del atlas disponibles + "Restaurar default").
- Botones: Guardar, Cancelar, Reset.
- Preview en tiempo real: mini-NPC en el modal con los cambios aplicados.

## 9. Defensa en profundidad

- **Tamaños**: todos validados en backend antes de escribir.
- **Path injection**: `agentId` debe matchear `CUSTOM_AGENT_ID_REGEX` — no hay slashes ni dots.
- **Corrupción de `characters.json`**: handling descripto en § 3.2.
- **Sprites malformados**: magic bytes check. Si falla decode en el canvas → log + render con sprite default.

## 10. Diferencias vs v0

`ARCHITECTURE.md` v0 § 8 definía un registry hardcodeado en `frontend/lib/agents.ts` sin customización. v1:
- Registry sigue en frontend para builtins, pero se **extiende** con custom agents vía WS.
- Customización persistida en backend (single source of truth en `characters.json`).
- `AgentDefinition` ya no es puramente estática — el `displayName`, `color` y `spriteVariant` efectivos resultan del merge.
