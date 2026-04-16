# US-03: Aprobar o rechazar un tool use del agente

**ID**: AB#<a asignar>
**Feature padre**: F-03 — Aprobación/rechazo de tool use
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **ver qué herramienta quiere ejecutar el agente y decidir si la autorizo o la rechazo**,
para **mantener el control explícito sobre toda acción que el agente realiza en mi filesystem o entorno**.

## Contexto

Claude Code opera en modo headless y requiere aprobación humana para cada tool use (lectura de archivos, escritura, ejecución de comandos, etc.). Cuando el agente necesita usar una herramienta, el flujo de respuesta se pausa y se presenta al usuario la solicitud con el nombre de la herramienta, los parámetros que usaría y el contexto de por qué la solicita. El usuario decide aprobar o rechazar. Solo después de esa decisión el flujo continúa o se le indica al agente que la herramienta fue denegada. En el MVP, toda tool use requiere aprobación: no hay aprobaciones automáticas ni allow-lists.

## Reglas de negocio

- RN1: Toda tool use requiere aprobación explícita del usuario. No hay "aprobar siempre" ni allow-lists automáticas en el MVP.
- RN2: Mientras existe una aprobación pendiente, el agente permanece en estado `waiting_approval` y el usuario no puede enviar mensajes nuevos a esa sesión.
- RN3: Solo puede haber una tool use pendiente de aprobación por sesión en un momento dado.
- RN4: Si el usuario rechaza la tool use, el backend notifica al proceso Claude Code la denegación; el agente puede continuar respondiendo o detenerse, según su propio comportamiento.
- RN5: Si el usuario cierra el chat mientras hay una tool use pendiente de aprobación, la sesión se cierra igualmente (el proceso se termina) sin ejecutar la tool use. Ver RN-T1 en Reglas Transversales.
- RN6: El usuario puede ver los parámetros completos de la tool use antes de decidir (ej: ruta del archivo a leer, contenido a escribir, comando a ejecutar).

## Criterios de aceptación

### Escenario 1: Aprobación de una tool use de lectura (happy path)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y el agente está procesando una respuesta
Cuando el agente solicita ejecutar la herramienta "Read" con el parámetro "src/components/Login.tsx"
Entonces el flujo de respuesta del agente se pausa
Y el NPC "Tech Lead" cambia al estado "waiting_approval" en el mapa
Y el chat muestra la solicitud indicando la herramienta "Read" y el archivo "src/components/Login.tsx"
Cuando el usuario aprueba la solicitud
Entonces el backend ejecuta la herramienta con los parámetros indicados
Y el NPC pasa al estado "tool_use"
Y el resultado de la lectura queda visible en el chat como bloque plegable
Y el agente retoma la generación de su respuesta
```

### Escenario 2: Rechazo de una tool use (alternativo)

```gherkin
Dado que el agente "Tech Lead" solicita ejecutar la herramienta "Write" sobre el archivo "src/config/secrets.ts"
Y el usuario ve los parámetros de la herramienta en el chat
Cuando el usuario rechaza la solicitud
Entonces el backend notifica al proceso Claude Code que la herramienta fue denegada
Y el chat registra que la tool use fue rechazada por el usuario
Y el NPC vuelve al estado "thinking" o "typing_response" según el comportamiento del agente
Y no se escribe ningún archivo en el filesystem
```

### Escenario 3: El usuario cierra el chat mientras hay una tool use pendiente (alternativo)

```gherkin
Dado que el agente "Dev Backend" tiene una tool use pendiente de aprobación
Y el NPC muestra estado "waiting_approval"
Cuando el usuario cierra el chat del agente "Dev Backend"
Entonces el proceso subyacente de Claude Code se termina sin ejecutar la tool use pendiente
Y el NPC "Dev Backend" desaparece del mapa
Y no se ejecuta ninguna acción en el filesystem
```

### Escenario 4: El proceso del agente termina mientras espera aprobación (error)

```gherkin
Dado que hay una tool use pendiente de aprobación para el agente "Tech Lead"
Cuando el proceso subyacente de Claude Code termina de forma inesperada
Entonces la solicitud de aprobación desaparece del chat
Y el NPC "Tech Lead" cambia al estado "error"
Y el sistema informa que el proceso del agente se interrumpió antes de recibir la decisión
```

### Escenario 5: La herramienta solicitada tiene parámetros que implican una acción destructiva (alternativo)

```gherkin
Dado que el agente "DevOps" solicita ejecutar la herramienta "Bash" con el comando "rm -rf dist/"
Y el usuario ve el comando completo en la solicitud de aprobación
Cuando el usuario decide aprobar la solicitud
Entonces el backend ejecuta el comando en la carpeta de trabajo de esa sesión
Y el resultado del comando queda visible en el chat como bloque plegable
```

## Dependencias

- **Funcionales**: US-01 (sesión activa), US-02 (flujo de conversación del cual emerge la tool use).
- **Técnicas**: parser del stream-json de Claude Code capaz de detectar eventos `tool_use`; mecanismo de stdin del proceso para comunicar la decisión; protocolo WebSocket con mensajes `tool_request`, `approve_tool`, `reject_tool`.
- **De diseño**: diseño del bloque de solicitud de aprobación en el chat (herramienta, parámetros, botones Aprobar/Rechazar); diseño del bloque de resultado de tool use plegable.

## Fuera de alcance

- Allow-lists de tools que se auto-aprueban (mejora futura).
- Edición de los parámetros de la tool use antes de aprobar.
- Historial de decisiones de aprobación persistido entre sesiones.
- Aprobación en lote de múltiples tool uses.

## Notas para UX/UI

El bloque de solicitud de aprobación debe mostrar de forma legible el nombre de la herramienta y sus parámetros. Para herramientas de escritura (`Write`, `Bash`), es deseable que el contenido sea expandible dado que puede ser extenso. Los botones Aprobar y Rechazar deben ser inequívocos y accesibles desde el teclado.

## Notas para Tech Lead

- El backend debe bloquear el procesamiento de nuevos mensajes de esa sesión mientras `pendingToolRequest` no sea resuelto.
- El mecanismo de comunicar la decisión al proceso Claude Code varía según el modo de permiso del CLI (`--permission-mode`). Verificar cómo se pasa la respuesta al stdin del proceso.
- RN3 (una sola tool use pendiente a la vez) debe ser validado en backend: si llegaran dos `tool_use` events del stream antes de resolver el primero, es un estado inválido que debe reportarse como error.

## Métricas de éxito

- Porcentaje de tool uses aprobadas vs rechazadas (indicador de confianza del usuario en el agente).
- Tiempo promedio de resolución de una solicitud de aprobación (cuánto tarda el usuario en decidir).

## Preguntas abiertas

- [ ] Q-06: ¿Qué hace exactamente Claude Code cuando recibe un rechazo? ¿Puede seguir respondiendo sin la tool, o la conversación queda en un estado irrecuperable? Esto afecta el mensaje que se muestra al usuario tras el rechazo.
- [ ] Q-07: ¿El resultado de la tool use (output) debe mostrarse siempre en el chat, o solo cuando el usuario lo expande? ¿Hay un límite de tamaño del output a mostrar?
