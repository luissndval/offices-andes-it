# ADR-006: Customización de personajes — schema, persistencia y scope

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

Requisito nuevo: el usuario puede customizar cada NPC (nombre, color, ropa/sprite variant) y esa customización debe **persistir** entre arranques.

La app es single-user local. No hay "mi customización vs la de otro usuario". No hay sync cross-device obligatorio. Pero el usuario espera que lo que customizó ayer siga mañana.

Hay que decidir **dónde** vive el estado y **qué formato** tiene.

Constantes del schema (ver `character-customization.md`):
- `CHARACTER_NAME_MAX_LEN = 32`
- `CHARACTER_NAME_MIN_LEN = 1`
- `CHARACTER_COLOR_HEX_LEN = 7` (#RRGGBB)
- `CHARACTER_CUSTOMIZATION_SCHEMA_VERSION = 1`

## Opciones consideradas

### Opción A: `localStorage` del browser (frontend-only)

**Pros**
- Cero trabajo de backend.
- Persistencia inmediata sin red.
- API trivial (Zustand persist middleware).

**Contras**
- Si el usuario limpia datos del browser → se pierde todo.
- Si usa otro browser → no hay customización.
- No es accesible para tooling CLI ni para backup.
- Difícil de versionar / migrar schema.
- No cruza profiles del browser.

### Opción B: Archivo JSON en `~/.agent-workbench/characters.json` gestionado por backend

**Pros**
- Persistencia real al filesystem del usuario.
- Sobrevive limpieza de browser, cambio de browser, reinstall.
- Permite backup manual (copia el archivo).
- Editable a mano en emergencias.
- Un archivo → una fuente de verdad, versionable con schema_version.

**Contras**
- Requiere round-trip al backend para leer/escribir.
- Lock management si hay concurrencia (mitigable: writes secuenciales desde single backend).
- OS-specific path resolution (HOME vs USERPROFILE).

### Opción C: SQLite embebido en backend (`~/.agent-workbench/agent-workbench.db`)

**Pros**
- Queries estructuradas.
- Migraciones robustas con tooling estándar.
- Escalable si mañana agregamos persistencia de conversaciones.

**Contras**
- Dependencia adicional pesada (better-sqlite3 ~5 MB nativo).
- Sobre-ingeniería para guardar un JSON con ~8 entradas.
- Complica backups (binario vs texto).
- No editable a mano.

### Opción D: Híbrido — backend JSON + cache en frontend Zustand

**Pros**
- Source of truth en filesystem (B).
- UI instantánea via Zustand sync local.
- Flush al backend en cambios (debounced).

**Contras**
- Doble estado: sync logic entre front y back.
- Si se rompe el sync, divergencia silenciosa.

## Decisión

**Opción B** (archivo JSON en `~/.agent-workbench/characters.json`) con **cache en Zustand** (degrada a Opción D si hace falta, pero arrancamos sin cache y medimos).

Rationale:
1. Persistencia real sin deuda de DB.
2. Editable/auditable por el usuario.
3. Migración de schema con `schema_version`.
4. YAGNI respecto a SQLite hasta que aparezca un segundo use case de persistencia.

Schema inicial:

```typescript
type CharacterCustomizationFile = {
  schemaVersion: number;                      // CHARACTER_CUSTOMIZATION_SCHEMA_VERSION
  updatedAt: string;                          // ISO 8601
  characters: Record<AgentId, CharacterCustomization>;
};

type CharacterCustomization = {
  agentId: string;                            // "tech-lead", "dev-backend", ...
  displayName: string;                        // max CHARACTER_NAME_MAX_LEN
  colorHex: string;                           // #RRGGBB, length CHARACTER_COLOR_HEX_LEN
  spriteVariant: string;                      // key del atlas (ver character-customization.md)
  updatedAt: string;                          // ISO 8601
};
```

Writes son **atómicos**: escribir a `characters.json.tmp` + `fs.rename` (atomic rename en POSIX y Windows NTFS).

## Consecuencias

### Positivas
- Configuración sobrevive cambios de browser y reinstalls.
- Usuario puede copiar el archivo entre máquinas (migración manual fácil).
- Schema versionado → migraciones futuras sin data loss.
- No hay DB que administrar.

### Negativas / Trade-offs aceptados
- Backend expone endpoints REST (o mensajes WS) para leer/escribir; ya no es stateless.
- File locking rudimentario (single-writer via backend singleton → OK).
- Si el usuario edita el archivo a mano y rompe el JSON, la app debe degradar con defaults y loguear warning claro.

### Acciones derivadas
- [ ] Definir ruta OS-aware: `path.join(os.homedir(), ".agent-workbench", "characters.json")`.
- [ ] Crear carpeta `~/.agent-workbench/` en primer arranque si no existe (con permisos `0700` en POSIX).
- [ ] Endpoint/mensajes: `get_characters`, `update_character`, `reset_character` (ver `websocket-protocol.md`).
- [ ] Validación server-side del schema (zod). Rechazar payload fuera de limits.
- [ ] Frontend: `useCharacterCustomizations` store Zustand, hidratado en primer connect.
- [ ] Migraciones: si `schemaVersion < current`, aplicar migraciones deterministas y re-escribir.
- [ ] Si archivo corrupto (JSON parse error): renombrar a `characters.corrupt.<timestamp>.json` y arrancar con defaults.
- [ ] Merge con custom agents (ver ADR-007): `characters.json` puede tener entries para agentes no builtin.

## Referencias
- `docs/technical/character-customization.md`
- ADR-007 (extensibilidad, comparte la misma carpeta `~/.agent-workbench/`)
