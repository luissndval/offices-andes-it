# US-01: Abrir un chat con un agente eligiendo carpeta de trabajo

**ID**: AB#<a asignar>
**Feature padre**: F-01 — Apertura de chat con selección de carpeta
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **abrir un chat con un agente eligiendo en ese momento la carpeta de trabajo**,
para **orientar al agente al proyecto o directorio que me interesa sin depender de una configuración global**.

## Contexto

El flujo de inicio de toda interacción con un agente parte del dock (barra de agentes disponibles). Al seleccionar un agente, el sistema pide al usuario que indique la carpeta del filesystem donde el agente va a operar. Esa elección queda vinculada exclusivamente a esa sesión. No existe un `projectPath` global: cada chat tiene el suyo propio. Una vez confirmada la carpeta, el proceso Claude Code se spawnea y el NPC aparece en el mapa.

## Reglas de negocio

- RN1: Cada sesión de chat tiene su propia carpeta de trabajo. No existe una carpeta global compartida entre chats.
- RN2: La carpeta elegida debe existir en el filesystem local en el momento de abrirla.
- RN3: Si el agente seleccionado ya tiene una sesión activa (mismo agente, cualquier carpeta), se permite abrir una segunda sesión con ese mismo agente en otra carpeta. (Ver pregunta abierta Q-01.)
- RN4: No se puede abrir una nueva sesión si se alcanzó el límite de 10 chats simultáneos.
- RN5: Si el archivo `.md` del system prompt del agente no existe o no es legible, la sesión no se puede abrir y el usuario recibe un mensaje claro.
- RN6: El backend no debe heredar la variable de entorno `ANTHROPIC_API_KEY` al spawnear el proceso Claude Code; si está presente, la sesión no puede abrirse y se informa al usuario.

## Criterios de aceptación

### Escenario 1: Apertura exitosa de un chat (happy path)

```gherkin
Dado que el usuario tiene Agent Workbench corriendo
Y no alcanzó el límite de 10 chats simultáneos
Y el agente "Tech Lead" está disponible en el dock
Cuando el usuario selecciona "Tech Lead" en el dock
Y elige la carpeta "/home/usuario/proyectos/mi-app" en el selector
Y confirma la selección
Entonces se establece una sesión de chat nueva con el agente "Tech Lead"
Y la carpeta de trabajo de esa sesión queda registrada como "/home/usuario/proyectos/mi-app"
Y el NPC "Tech Lead" aparece en el escritorio asignado en el mapa
Y el chat queda abierto y listo para recibir mensajes
```

### Escenario 2: El usuario cancela la selección de carpeta (alternativo)

```gherkin
Dado que el usuario seleccionó "Tech Lead" en el dock
Y el selector de carpeta está visible
Cuando el usuario cancela la selección sin elegir ninguna carpeta
Entonces no se abre ningún chat
Y el NPC "Tech Lead" no aparece en el mapa
Y el dock permanece en su estado anterior
```

### Escenario 3: El mismo agente ya tiene una sesión activa (alternativo)

```gherkin
Dado que el agente "Dev Backend" ya tiene una sesión activa con la carpeta "/home/usuario/proyectos/api"
Cuando el usuario selecciona "Dev Backend" en el dock nuevamente
Y elige la carpeta "/home/usuario/proyectos/otro-servicio"
Y confirma la selección
Entonces se abre una segunda sesión del agente "Dev Backend" con carpeta "/home/usuario/proyectos/otro-servicio"
Y ambas sesiones coexisten en el mapa como NPCs diferenciables
```

### Escenario 4: La carpeta elegida no existe (error)

```gherkin
Dado que el usuario seleccionó "Tech Lead" en el dock
Cuando el usuario ingresa manualmente la ruta "/home/usuario/proyectos/no-existe"
Y confirma la selección
Entonces no se abre ningún chat
Y el sistema informa que la carpeta indicada no existe o no es accesible
Y el usuario puede elegir otra carpeta o cancelar
```

### Escenario 5: Se alcanzó el límite de chats simultáneos (error)

```gherkin
Dado que el usuario ya tiene 10 chats abiertos simultáneamente
Cuando el usuario intenta abrir un chat adicional con cualquier agente
Entonces el sistema no permite la apertura
Y informa al usuario que debe cerrar algún chat activo antes de abrir uno nuevo
```

### Escenario 6: El system prompt del agente no está disponible (error)

```gherkin
Dado que el archivo de system prompt del agente "QA Tester" no existe en la carpeta elegida
Cuando el usuario intenta abrir un chat con "QA Tester" sobre esa carpeta
Entonces no se abre ningún chat
Y el sistema informa que el system prompt del agente no fue encontrado
Y sugiere verificar la presencia del archivo correspondiente
```

## Dependencias

- **Funcionales**: ninguna US previa requerida (es el punto de entrada del sistema).
- **Técnicas**: Claude Code CLI instalado y autenticado con sesión Max activa; sistema de archivos local accesible desde el backend; mecanismo de folder picker (nativo del OS o implementado en frontend).
- **De diseño**: diseño del dock con lista de agentes disponibles; diseño del selector de carpeta; diseño de feedback de error.

## Fuera de alcance

- Configuración de un `projectPath` global persistente entre sesiones.
- Validación del contenido de la carpeta (solo se valida que exista).
- Auto-completado de rutas en el selector de carpeta (puede ser mejora futura).
- Historial de carpetas usadas previamente (puede ser mejora futura).

## Notas para UX/UI

El selector de carpeta es un elemento crítico de este flujo. Se desconoce si debe ser un explorador de archivos nativo del OS, un input de texto libre, o un componente personalizado. Esto queda como pregunta abierta Q-02.

## Notas para Tech Lead

- El backend debe validar que el path existe y es un directorio antes de spawnear el proceso.
- El backend debe eliminar `ANTHROPIC_API_KEY` del entorno antes de spawnear Claude Code.
- Múltiples sesiones del mismo `agentId` son posibles; el `sessionId` es el discriminador, no el `agentId`.
- La carga del system prompt debe ocurrir desde la carpeta elegida (`.claude/agents/<id>.md`), no desde una ruta global. Ver Q-03.

## Métricas de éxito

- Porcentaje de intentos de apertura de chat que terminan en sesión activa.
- Tiempo promedio desde que el usuario selecciona agente hasta que el chat está listo para recibir mensajes.

## Preguntas abiertas

- [ ] Q-01: ¿Se permite abrir múltiples instancias del mismo agente en paralelo? Si sí, ¿cómo se diferencian visualmente los NPCs en el mapa (mismo sprite duplicado, badge de número, etc.)?
- [ ] Q-02: ¿El selector de carpeta es un explorador de archivos nativo del OS (dialog), un input de texto libre, o un componente propio? ¿Debe mostrar historial de rutas recientes?
- [ ] Q-03: ¿El system prompt del agente se busca en la carpeta de trabajo elegida (`.claude/agents/<id>.md`) o en alguna ubicación central del repositorio de Agent Workbench? ¿Qué pasa si la carpeta elegida no tiene ese archivo pero hay uno en la ubicación central?
