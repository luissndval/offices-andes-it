# US-07: Abrir múltiples chats en paralelo con distintos agentes y carpetas

**ID**: AB#<a asignar>
**Feature padre**: F-07 — Múltiples chats en paralelo
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **tener varios chats abiertos al mismo tiempo, cada uno con un agente diferente y su propia carpeta de trabajo**,
para **orquestar múltiples agentes trabajando en distintos contextos sin necesidad de abrir terminales separadas**.

## Contexto

La propuesta de valor central de Agent Workbench es reemplazar el manejo de N terminales abiertas con N sesiones de Claude Code. Esto solo se cumple si el sistema soporta múltiples chats simultáneos de forma estable. Cada chat es completamente independiente: tiene su propio proceso Claude Code, su propia carpeta de trabajo, su propio NPC en el mapa y su propia ventana de chat. Los chats no comparten estado entre sí ni se afectan mutuamente. El usuario puede interactuar con cualquiera de ellos en cualquier momento.

## Reglas de negocio

- RN1: Cada chat activo tiene exactamente un proceso Claude Code dedicado. Los procesos son independientes y no comparten estado.
- RN2: Cada chat tiene su propia carpeta de trabajo, elegida al abrirlo (ver US-01). Distintos chats pueden apuntar a la misma carpeta o a carpetas diferentes.
- RN3: El límite máximo de chats simultáneos es 10. Al intentar abrir un undécimo chat, el sistema rechaza la apertura e informa al usuario.
- RN4: Cada chat abierto tiene exactamente un NPC en el mapa. No puede haber NPC sin chat asociado.
- RN5: Las acciones del usuario en un chat (enviar mensaje, aprobar tool use, cerrar) no afectan el estado de los otros chats.
- RN6: El usuario puede abrir múltiples sesiones del mismo tipo de agente (ej: dos instancias de "Dev Backend") siempre que no supere el límite de 10.
- RN7: La ventana de chat puede traerse al frente haciendo click en el NPC correspondiente en el mapa.

## Criterios de aceptación

### Escenario 1: Apertura de tres chats en paralelo con distintos agentes (happy path)

```gherkin
Dado que Agent Workbench está corriendo sin chats activos
Cuando el usuario abre un chat con el agente "Tech Lead" sobre la carpeta "/home/usuario/proyectos/backend"
Y abre un chat con el agente "QA Tester" sobre la carpeta "/home/usuario/proyectos/frontend"
Y abre un chat con el agente "DevOps" sobre la carpeta "/home/usuario/proyectos/infra"
Entonces el mapa muestra tres NPCs distintos en sus escritorios asignados
Y cada NPC refleja el estado de su agente correspondiente de forma independiente
Y el usuario puede enviar mensajes a cualquiera de los tres chats
```

### Escenario 2: Los agentes responden de forma independiente y simultánea (alternativo)

```gherkin
Dado que el usuario tiene tres chats abiertos con "Tech Lead", "QA Tester" y "DevOps"
Cuando el usuario envía un mensaje a "Tech Lead"
Y mientras "Tech Lead" responde, el usuario envía un mensaje a "QA Tester"
Entonces ambos agentes procesan sus mensajes de forma concurrente e independiente
Y las respuestas de cada agente aparecen en su chat correspondiente
Y el estado de cada NPC en el mapa refleja de forma independiente lo que hace su agente
```

### Escenario 3: El usuario abre dos sesiones del mismo tipo de agente (alternativo)

```gherkin
Dado que ya existe un chat abierto con el agente "Dev Backend" sobre la carpeta "/home/usuario/proyectos/api-v1"
Cuando el usuario abre un segundo chat con el agente "Dev Backend" sobre la carpeta "/home/usuario/proyectos/api-v2"
Entonces ambas sesiones coexisten con NPCs diferenciables en el mapa
Y cada chat opera de forma completamente independiente sobre su carpeta
```

### Escenario 4: El usuario intenta abrir un undécimo chat (error)

```gherkin
Dado que el usuario ya tiene 10 chats abiertos simultáneamente
Cuando el usuario intenta abrir un chat adicional con cualquier agente
Entonces el sistema no abre el chat
Y informa al usuario que alcanzó el límite máximo de 10 chats simultáneos
Y sugiere cerrar algún chat activo antes de abrir uno nuevo
```

### Escenario 5: Un chat falla sin afectar los demás (error)

```gherkin
Dado que el usuario tiene tres chats abiertos con "Tech Lead", "QA Tester" y "DevOps"
Cuando el proceso de Claude Code del chat "QA Tester" termina de forma inesperada
Entonces el NPC "QA Tester" cambia al estado "error" en el mapa
Y el chat "QA Tester" muestra el mensaje de error correspondiente
Y los chats "Tech Lead" y "DevOps" continúan operando con normalidad
```

### Escenario 6: El usuario cierra todos los chats (alternativo)

```gherkin
Dado que el usuario tiene varios chats abiertos
Cuando el usuario cierra cada chat uno por uno
Entonces los NPCs desaparecen del mapa a medida que se cierran sus chats correspondientes
Y al cerrarse el último chat, el mapa queda vacío de NPCs
Y los escritorios quedan disponibles para nuevas sesiones
```

## Dependencias

- **Funcionales**: US-01 (apertura de chat), US-02 (conversación), US-03 (aprobación de tool use), US-04 (cierre de chat) — todos estos flujos deben funcionar de forma independiente por sesión.
- **Técnicas**: `SessionManager` en el backend capaz de mantener múltiples `AgentSession` concurrentes; estado Zustand en el frontend con múltiples sesiones; el mapa debe renderizar múltiples NPCs simultáneamente y gestionar colisiones de escritorios.
- **De diseño**: gestión de múltiples ventanas de chat simultáneas (z-order, foco, posicionamiento); indicadores de estado independientes por NPC en el mapa.

## Fuera de alcance

- Comunicación o coordinación automática entre chats (orquestación multi-agente — fuera del MVP).
- Agrupación o vinculación de chats en proyectos.
- Vista de "todas las conversaciones" en un solo panel.
- Límite configurable por el usuario (el límite de 10 es fijo en el MVP).

## Notas para UX/UI

Con varios NPCs en el mapa y varias ventanas de chat abiertas, la gestión del espacio visual se vuelve crítica. El usuario debe poder identificar rápidamente qué chat corresponde a qué NPC. Hacer click en un NPC del mapa debe traer al frente la ventana de chat correspondiente. Ver Q-14 sobre comportamiento cuando dos instancias del mismo agente están activas.

## Notas para Tech Lead

- El `sessionId` es el discriminador único de cada sesión, no el `agentId`. Esto es especialmente importante para sesiones múltiples del mismo agente.
- El `SessionManager` debe garantizar aislamiento total entre procesos: un proceso colgado no debe bloquear a otros.
- Ver Q-15 sobre gestión de escritorios cuando hay más chats activos que escritorios físicos en el mapa.

## Métricas de éxito

- Número promedio de chats abiertos simultáneamente por sesión de uso.
- Porcentaje de usuarios que abren 3 o más chats en paralelo.

## Preguntas abiertas

- [ ] Q-14: Si el usuario tiene dos sesiones del mismo agente (ej: dos "Dev Backend"), ¿cómo se diferencian en el mapa? ¿Mismo sprite con badge numérico, nombre distinto, color distinto? ¿Pueden ocupar el mismo escritorio o se asignan escritorios distintos?
- [ ] Q-15: El mapa tiene 8 escritorios fijos en el MVP. Si el usuario abre más de 8 chats (hasta el límite de 10), ¿dónde se ubican los NPCs adicionales? ¿Se generan posiciones dinámicas o se bloquea en 8 simultáneos por restricción del mapa?
