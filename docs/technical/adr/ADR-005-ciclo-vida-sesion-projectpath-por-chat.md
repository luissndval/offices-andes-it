# ADR-005: Ciclo de vida de sesión con `projectPath` por chat — seguridad y sandboxing

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

`ARCHITECTURE.md` v0 asumía un `config/projects.json` global con **whitelist** de paths permitidos. Cada `open_session` se validaba contra esa lista antes de spawnear Claude Code.

Nuevo requisito: **folder picker por chat**. El usuario elige cualquier carpeta al momento de abrir un chat. No hay lista pre-definida. Esto elimina la red de seguridad existente.

La app es **local, single-user, bindea a 127.0.0.1**. El vector de ataque realista no es "otro usuario", es:
- Un script del propio agente que navega a `/etc/passwd` o `C:\Windows\System32`.
- Un symlink en el proyecto que apunta afuera.
- Un typo del usuario que pica `/` o `C:\` como folder.

Constantes (ver `session-lifecycle.md`):
- `SESSION_MAX_CONCURRENT = 10`
- `SESSION_SPAWN_TIMEOUT_MS = 15000`
- `SESSION_IDLE_TIMEOUT_MS = 3600000` (1 h)
- `SESSION_KILL_GRACE_MS = 5000`
- `PATH_MAX_DEPTH_SCAN = 6` (validación anti-rootfs)

## Opciones consideradas

### Opción A: Sin validación — trust the user

**Pros**
- Cero fricción. El usuario abre lo que quiere.
- Simplicidad extrema.

**Contras**
- Agente con Bash habilitado + cwd en `/` → desastre silencioso.
- Typo catastrófico imposible de recuperar.
- No pasa un code review de seguridad ni mínimo.

### Opción B: Whitelist dinámica persistida — el usuario agrega proyectos una sola vez

**Pros**
- Misma seguridad que `ARCHITECTURE.md` v0 pero UX mejor.
- Auditable: lista clara de carpetas "autorizadas".
- El usuario elige cuándo agregar una nueva.

**Contras**
- Contradice el nuevo requisito de "picker libre por chat" explícito.
- Fricción en el happy path (primer uso de cada proyecto requiere "agregar").
- Persistencia extra (file + UI de gestión).

### Opción C: Validación por reglas + confirmación explícita en paths riesgosos

**Pros**
- Cumple el requisito (picker libre) sin desprotegernos.
- Bloquea lo obviamente peligroso (rootfs, `/etc`, `C:\Windows`, `~/.ssh`).
- Pide **doble confirmación** en paths fuera del home del usuario.
- Rechaza paths que contengan componentes simbólicos fuera del directorio raíz seleccionado.

**Contras**
- Reglas deben mantenerse — false positives posibles.
- No reemplaza decisiones humanas malas (el usuario puede confirmar igual).
- Lista de blocked paths es OS-dependiente.

### Opción D: Sandbox real (Docker / firejail / bwrap por sesión)

**Pros**
- Aislamiento fuerte de verdad.
- Permite dar más libertad al agente sin exponer el host.

**Contras**
- Enorme complejidad para single-user local.
- Dependencias externas (Docker running).
- Rompe el caso de uso: el agente **necesita** tocar archivos del proyecto real del usuario.
- Performance de startup por sesión.

## Decisión

**Opción C**: validación por reglas + confirmación explícita. Es el único balance defendible entre "picker libre" y "no apuntarse al pie".

Reglas concretas:

1. **Normalización**: `path.resolve()` + `fs.realpathSync()` para resolver symlinks.
2. **Denylist hard** (aborta, no confirma):
   - Root del filesystem (`/`, `C:\`, `D:\`, etc.).
   - Paths de sistema: `/etc`, `/usr`, `/var`, `/sys`, `/proc`, `/boot`, `C:\Windows`, `C:\Program Files*`.
   - Home sin subcarpeta (`~`, `C:\Users\<u>` sin más).
   - `~/.ssh`, `~/.aws`, `~/.claude`, `~/.config` (explícitamente).
3. **Warnlist** (requiere confirmación explícita en UI del usuario, una vez por path):
   - Paths fuera de `$HOME` (o `%USERPROFILE%`).
   - Paths que contengan `..` antes de resolver.
4. **Path depth**: rechazar si profundidad relativa a root < 3 (`/foo` no, `/home/x/proyectos/x` sí).
5. **Verificación de existencia y tipo**: debe ser directorio; no ser un mount point simbólico que escape del home.
6. **Cache de validaciones aceptadas** en backend en memoria por sesión del server (no persiste en disco) — el usuario confirma 1 vez por path por arranque.

Validación se ejecuta en **backend** al recibir `open_session`. Frontend muestra el diálogo de confirmación si backend responde `path_requires_confirmation`.

## Consecuencias

### Positivas
- UX de picker libre sin perder red de seguridad razonable.
- Denylist captura los errores catastróficos clásicos.
- Warnlist deja auditabilidad: cada confirmación se loguea.
- Defensa en profundidad: aunque el agente mienta, el cwd no puede ser `/etc`.

### Negativas / Trade-offs aceptados
- **No es sandbox real**. Si el usuario pica un proyecto con scripts maliciosos, el agente corre con sus permisos.
- Reglas son OS-dependientes y requieren testing por plataforma (Win/Linux/Mac).
- False positives posibles (ej: alguien con repos en `/opt/work`) — mitigado con warnlist, no con rechazo.
- Ciclo de vida de la sesión se complica: hay un estado `waiting_path_confirmation` nuevo.

### Acciones derivadas
- [ ] Implementar `validateProjectPath(path)` en `backend/src/security/pathGuard.ts` con tests por OS.
- [ ] Nuevos mensajes de protocolo: `path_requires_confirmation`, `confirm_path` (ver `websocket-protocol.md`).
- [ ] Logging de toda confirmación en `backend/logs/audit.log` con timestamp + path.
- [ ] Documentar en README la lista de paths bloqueados y la filosofía de seguridad.
- [ ] `ANTHROPIC_API_KEY` se sigue `delete`-eando en el env del subproceso (heredado de v0).
- [ ] Env del child proceso de Claude Code se filtra: solo PATH, HOME, LANG, TZ, TERM, USERPROFILE (Windows).
- [ ] Cada sesión tiene `cwd` congelado al momento de `open_session`. Si el usuario quiere cambiar, cierra y abre nueva.
- [ ] Límite `SESSION_MAX_CONCURRENT` aplicado a nivel `SessionManager`.
- [ ] Al cerrar sesión: SIGTERM, esperar `SESSION_KILL_GRACE_MS`, SIGKILL si no terminó. Cerrar pty asociada.
- [ ] Al cerrar WS sin close_session: **no** matar automáticamente — esperar reconnect hasta `SESSION_IDLE_TIMEOUT_MS`. Si expira, kill.

## Referencias
- `ARCHITECTURE.md` v0 sección 12
- `docs/technical/session-lifecycle.md`
- `docs/technical/websocket-protocol.md`
- OWASP Path Traversal — https://owasp.org/www-community/attacks/Path_Traversal
