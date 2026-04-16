# US-09: Agregar un personaje custom (cargar .md + elegir sprite)

**ID**: AB#<a asignar>
**Feature padre**: F-09 — Agregar personaje custom
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Should
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **agregar un agente nuevo definiendo su system prompt en un archivo `.md` y eligiendo un sprite**,
para **extender el conjunto de agentes disponibles con roles propios sin necesidad de modificar el código de la aplicación**.

## Contexto

Agent Workbench viene con un conjunto de agentes predefinidos (Tech Lead, Dev Backend, QA, etc.). Sin embargo, el usuario puede necesitar agentes con roles específicos para su contexto (ej: "Experto en Migración de Base de Datos", "Revisor de Documentación", etc.). Este flujo permite crear un agente nuevo proveyendo únicamente el archivo Markdown con el system prompt y eligiendo uno de los sprites disponibles. El nuevo agente queda disponible en el dock exactamente igual que los agentes predefinidos.

## Reglas de negocio

- RN1: El system prompt del agente custom se define en un archivo `.md`. El contenido del archivo se usa íntegramente como system prompt al spawnear el proceso Claude Code.
- RN2: El archivo `.md` debe tener contenido no vacío. Un archivo sin contenido no genera un agente válido.
- RN3: El nombre display del nuevo agente es requerido y no puede estar vacío ni duplicar exactamente el nombre display de un agente ya existente. Ver Q-18.
- RN4: El sprite se elige de la lista de sprites disponibles en el proyecto base. No se pueden cargar sprites externos en el MVP.
- RN5: El nuevo agente recibe un `agentId` generado automáticamente a partir del nombre display (ej: "Experto DB" → `experto-db`). Si hay colisión de `agentId`, se resuelve automáticamente con sufijo numérico.
- RN6: El nuevo agente se guarda en la configuración persistente y aparece en el dock a partir de ese momento y en futuras sesiones de la aplicación.
- RN7: El nuevo agente necesita un escritorio asignado en el mapa. Ver Q-19 sobre la asignación de escritorios para agentes custom.
- RN8: El archivo `.md` puede cargarse desde cualquier ubicación del filesystem del usuario, no necesariamente desde `.claude/agents/`.

## Criterios de aceptación

### Escenario 1: Creación exitosa de un agente custom (happy path)

```gherkin
Dado que el usuario accede al flujo de agregar un personaje custom
Cuando el usuario provee el archivo "/home/usuario/prompts/experto-db.md" como system prompt
Y escribe el nombre display "Experto DB"
Y elige el sprite "character_generic_blue"
Y confirma la creación
Entonces el agente "Experto DB" aparece en el dock junto a los agentes predefinidos
Y el usuario puede abrir un chat con "Experto DB" eligiendo una carpeta de trabajo
Y al abrir el chat, el NPC "Experto DB" aparece en el mapa con el sprite "character_generic_blue"
Y el agente "Experto DB" usa el contenido del archivo como su system prompt
```

### Escenario 2: El usuario crea un agente con nombre ya existente (alternativo)

```gherkin
Dado que ya existe un agente con el nombre display "Tech Lead"
Cuando el usuario intenta crear un agente custom con el nombre display "Tech Lead"
Y confirma la creación
Entonces el sistema no crea el agente
Y informa al usuario que ya existe un agente con ese nombre
Y permite al usuario cambiar el nombre antes de confirmar
```

### Escenario 3: El archivo .md está vacío (error)

```gherkin
Dado que el usuario seleccionó un archivo ".md" cuyo contenido está vacío
Cuando el usuario confirma la creación del agente
Entonces el sistema no crea el agente
Y informa al usuario que el archivo de system prompt no puede estar vacío
Y el usuario puede seleccionar otro archivo o cancelar
```

### Escenario 4: El archivo seleccionado no existe o no es accesible (error)

```gherkin
Dado que el usuario ingresó la ruta "/home/usuario/prompts/no-existe.md" para el system prompt
Cuando el usuario confirma la creación del agente
Entonces el sistema no crea el agente
Y informa que el archivo no existe o no es accesible
Y permite al usuario seleccionar otro archivo o cancelar
```

### Escenario 5: El usuario cancela el flujo a mitad (alternativo)

```gherkin
Dado que el usuario inició el flujo de creación de agente custom
Y ya completó el nombre y seleccionó el sprite pero no confirmó
Cuando el usuario cancela el flujo
Entonces no se crea ningún agente nuevo
Y el dock permanece con los agentes existentes sin cambios
```

### Escenario 6: El agente custom recibe actualizaciones al archivo .md (alternativo)

```gherkin
Dado que existe un agente custom "Experto DB" cuyo system prompt apunta a "/home/usuario/prompts/experto-db.md"
Cuando el usuario modifica el contenido del archivo "experto-db.md" fuera de la aplicación
Y abre un nuevo chat con "Experto DB"
Entonces la nueva sesión usa el contenido actualizado del archivo como system prompt
```

## Dependencias

- **Funcionales**: US-01 (el nuevo agente se usa exactamente igual que los predefinidos al abrir un chat); US-08 (la customización visual del nuevo agente sigue las mismas reglas que para agentes predefinidos).
- **Técnicas**: mecanismo de persistencia de la configuración de agentes (debe soportar agentes definidos por el usuario además de los predefinidos); el backend debe poder cargar el system prompt desde rutas arbitrarias del filesystem; el `agentId` generado no debe colisionar con los predefinidos.
- **De diseño**: flujo de creación de agente custom (pasos: nombre → archivo → sprite → confirmación); preview del NPC con el sprite seleccionado; selector de archivo del filesystem.

## Fuera de alcance

- Carga de sprites externos (PNG propios del usuario) — el MVP solo usa los sprites del proyecto base.
- Editor de system prompt en línea dentro de la aplicación (el `.md` se edita externamente).
- Eliminación de agentes custom desde la UI (puede ser mejora futura). Ver Q-20.
- Compartir agentes custom con otros usuarios.
- Asignación manual de escritorio en el mapa (se asigna automáticamente).

## Notas para UX/UI

El flujo de creación debe ser simple: idealmente 3 pasos (nombre → archivo → sprite) con preview del NPC resultante. El selector de archivo debe ser una forma sencilla de navegar el filesystem local. Ver Q-21 sobre si se puede "soltar" directamente el archivo .md en la interfaz (drag & drop).

## Notas para Tech Lead

- Al cargar el system prompt para una sesión de agente custom, el backend lee el archivo desde la ruta absoluta registrada en la configuración. Si el archivo fue movido o eliminado, la apertura del chat debe fallar con mensaje claro (mismo flujo que el escenario 6 de US-01).
- El `agentId` generado automáticamente debe ser URL-safe y persistente (no cambiar si el usuario renombra el display name).
- Ver Q-19 sobre la asignación de escritorios en el mapa para más de 8 agentes.

## Métricas de éxito

- Número de agentes custom creados por usuario.
- Porcentaje de agentes custom que tienen al menos una sesión abierta.

## Preguntas abiertas

- [ ] Q-18: ¿El nombre display debe ser único entre todos los agentes (predefinidos + custom), o solo entre los custom? ¿O simplemente se permite duplicado y se diferencia por `agentId`?
- [ ] Q-19: El mapa tiene 8 escritorios fijos. Si el usuario agrega más agentes custom, ¿se generan escritorios dinámicamente? ¿Dónde se ubican en el mapa? ¿Hay un límite total de agentes registrados?
- [ ] Q-20: ¿Se puede eliminar un agente custom desde la UI? Si hay un chat activo de ese agente, ¿qué pasa?
- [ ] Q-21: ¿El flujo de carga del `.md` soporta drag & drop del archivo directamente sobre la interfaz, además del selector de archivo clásico?
