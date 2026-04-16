# US-02: Conversar con un agente (enviar mensaje, recibir respuesta en streaming)

**ID**: AB#<a asignar>
**Feature padre**: F-02 — Conversación con agente (streaming)
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **enviar un mensaje a un agente y recibir su respuesta de forma progresiva (streaming)**,
para **tener retroalimentación inmediata del agente sin esperar a que complete toda su respuesta**.

## Contexto

Una vez que el chat está abierto (ver US-01), el usuario puede enviar mensajes de texto al agente. El agente procesa el mensaje y devuelve una respuesta que llega en chunks progresivos (streaming), de modo que el usuario ve el texto aparecer a medida que el agente lo genera. El NPC en el mapa refleja el estado del agente (pensando, respondiendo, usando herramienta) mediante animaciones sincronizadas. Si el agente necesita usar una herramienta durante la respuesta, el flujo se interrumpe y se delega a US-03.

## Reglas de negocio

- RN1: El usuario solo puede enviar un mensaje cuando el agente está en estado `idle` o cuando no hay una aprobación de tool use pendiente. (Ver pregunta abierta Q-04.)
- RN2: La respuesta del agente se muestra de forma progresiva: cada fragmento de texto recibido se agrega al final del mensaje en construcción, sin esperar al final.
- RN3: El NPC en el mapa refleja el estado del agente en tiempo real: `thinking` mientras procesa, `typing_response` mientras genera texto, `tool_use` cuando ejecuta una herramienta, `waiting_approval` cuando espera decisión del usuario, `error` si algo falla.
- RN4: Si el agente no responde en 60 segundos, la sesión se considera en timeout y el usuario es informado.
- RN5: Los mensajes del usuario y del agente quedan en el historial del chat mientras la sesión está activa. Al cerrar el chat, el historial se pierde (no hay persistencia entre sesiones).
- RN6: Si el agente genera una respuesta que incluye tool calls, la respuesta de texto visible hasta ese punto permanece en el chat; los tool calls se gestionan según US-03.

## Criterios de aceptación

### Escenario 1: Envío de mensaje y respuesta en streaming (happy path)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y el agente está en estado "idle"
Cuando el usuario escribe "explicame la estructura del proyecto" y lo envía
Entonces el mensaje del usuario aparece en el historial del chat
Y el NPC "Tech Lead" cambia al estado "thinking"
Y a continuación el NPC pasa al estado "typing_response"
Y la respuesta del agente aparece progresivamente en el chat, fragmento a fragmento
Y al completarse la respuesta el NPC vuelve al estado "idle"
```

### Escenario 2: El agente inicia una tool use en medio de la respuesta (alternativo)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y el usuario envió el mensaje "leé el archivo README.md y resumilo"
Y el agente comenzó a responder con texto parcial
Cuando el agente solicita ejecutar la herramienta "Read" sobre "README.md"
Entonces el texto parcial ya generado permanece visible en el chat
Y la conversación muestra una solicitud de aprobación de tool use pendiente
Y el flujo continúa según US-03
```

### Escenario 3: El usuario envía múltiples mensajes seguidos sin esperar respuesta (alternativo)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y el agente está procesando una respuesta en curso
Cuando el usuario intenta enviar un segundo mensaje antes de que el primero termine
Entonces el segundo mensaje no se envía
Y el sistema informa al usuario que el agente está ocupado y debe esperar a que finalice
```

### Escenario 4: El agente no responde en el tiempo límite (error)

```gherkin
Dado que el usuario envió un mensaje al agente "Tech Lead"
Y pasaron 60 segundos sin recibir ningún fragmento de respuesta
Entonces el sistema marca la sesión con estado "error"
Y el NPC "Tech Lead" cambia al estado "error" en el mapa
Y el chat muestra el mensaje "El agente no respondió a tiempo. Podés reintentar o cerrar el chat."
```

### Escenario 5: El proceso del agente termina inesperadamente durante la respuesta (error)

```gherkin
Dado que el agente "Tech Lead" está generando una respuesta en streaming
Cuando el proceso subyacente de Claude Code termina de forma inesperada
Entonces el streaming se detiene
Y el NPC "Tech Lead" cambia al estado "error" en el mapa
Y el chat muestra el texto parcial ya recibido marcado como incompleto
Y el sistema informa que el proceso del agente se interrumpió
```

## Dependencias

- **Funcionales**: US-01 (debe existir una sesión de chat abierta para poder enviar mensajes).
- **Técnicas**: protocolo WebSocket activo entre frontend y backend; parser de `stream-json` de Claude Code corriendo en el backend; estado Zustand con las sesiones activas en el frontend.
- **De diseño**: diseño del campo de entrada de mensajes; diseño del historial de chat con mensajes en streaming; diseño de los estados de NPC y sus animaciones.

## Fuera de alcance

- Edición o eliminación de mensajes ya enviados.
- Persistencia del historial entre sesiones.
- Envío de archivos adjuntos o imágenes en el mensaje.
- Soporte para markdown enriquecido en los mensajes del usuario (puede ser mejora futura).

## Notas para UX/UI

El indicador visual de estado del agente (pensando / respondiendo) debe ser perceptible tanto en el NPC del mapa como en el chat, para que el usuario sepa que hay actividad aunque la ventana del chat no esté en primer plano.

## Notas para Tech Lead

- El estado `thinking` inicia cuando el backend recibe el mensaje del usuario y se lo envía al proceso Claude Code. El estado `typing_response` inicia cuando llega el primer `message_chunk`.
- El timeout de 60 segundos corre desde el envío del mensaje hasta el primer chunk recibido, no hasta la respuesta completa.
- La regla de "un mensaje a la vez" (RN1) debe ser enforced también en el backend para evitar condiciones de carrera con el stdin del proceso.

## Métricas de éxito

- Tiempo hasta el primer token (TTFT) promedio por sesión.
- Porcentaje de mensajes que completan su respuesta sin timeout ni error.

## Preguntas abiertas

- [ ] Q-04: ¿Debe el sistema hacer cola de mensajes o simplemente bloquear el envío mientras el agente está ocupado? Si hay cola, ¿cuál es el límite de mensajes en cola?
- [ ] Q-05: ¿El timeout de 60 segundos es configurable por el usuario o por agente, o es fijo?
