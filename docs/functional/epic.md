# Épica: Agent Workbench MVP

**ID**: AB#<a asignar>
**Tipo**: Funcional
**Estado**: En definición

## Descripción

Agent Workbench es una aplicación web de uso estrictamente local que permite a un desarrollador individual interactuar con múltiples agentes de Claude Code a través de una interfaz tipo oficina pixel art 2D. Cada agente activo aparece como un NPC en el mapa y posee su propio proceso de Claude Code corriendo en background, con acceso a una carpeta de trabajo elegida por el usuario en el momento de abrir la conversación.

La base de partida es el proyecto de código abierto **pablodelucca/pixel-agents** (licencia MIT), del cual se reutilizan assets de oficina, sprites Metro City, la state machine de NPC, el renderer Canvas 2D y la detección de actividad del agente. Sobre esa base se construye la experiencia de chat, terminal embebida y personalización de personajes.

## Objetivo de negocio

Reemplazar la práctica de mantener N terminales abiertas con N sesiones de Claude Code por una única interfaz visual, cohesiva y más cómoda, que expone el estado de cada agente y permite supervisar, aprobar y guiar su trabajo desde un solo lugar.

## Actor principal

**Usuario desarrollador**: persona que ejecuta Agent Workbench en su máquina local para orquestar uno o más agentes de Claude Code sobre proyectos de su filesystem.

## Alcance del MVP

El MVP cubre los flujos esenciales para que el usuario pueda:

1. Abrir un chat con cualquier agente, eligiendo la carpeta de trabajo en ese momento.
2. Conversar con el agente y recibir respuestas en streaming.
3. Aprobar o rechazar los tool uses que el agente solicita.
4. Cerrar el chat cuando ya no lo necesita.
5. Monitorear los tool calls del agente mediante una terminal read-only embebida.
6. Ejecutar comandos propios en la carpeta del chat mediante una terminal interactiva embebida.
7. Mantener múltiples chats abiertos en paralelo, cada uno con su propio agente y carpeta.
8. Personalizar nombre, ropa y color de cualquier NPC existente.
9. Agregar un agente/personaje nuevo cargando un archivo `.md` con su system prompt y eligiendo un sprite.

## Premisa central no negociable

**Cantidad de chats abiertos = cantidad de NPCs visibles en el mapa.**

Abrir un chat hace aparecer el NPC. Cerrar el chat lo hace desaparecer. No hay NPCs decorativos sin chat asociado (salvo los elementos ambientales estáticos del mapa).

## Restricciones

- Uso estrictamente local: un solo usuario, backend en `127.0.0.1`.
- No requiere API key de Anthropic: usa la suscripción Claude Max del usuario.
- No persiste conversaciones entre sesiones: cada apertura de chat es limpia.
- No hay aprobaciones automáticas de tool use en el MVP: toda tool use requiere decisión explícita del usuario.
- Máximo 10 chats simultáneos (límite soft).
- Cada sesión usa la carpeta elegida al abrir el chat; no hay `projectPath` global.

## Reglas de negocio transversales

Las siguientes reglas aplican a múltiples User Stories y deben ser consistentes en toda la implementación:

- **RN-T1: Cierre de chat con tool use pendiente.** Si el usuario cierra un chat mientras hay una tool use pendiente de aprobación, la sesión se cierra igualmente, el proceso se termina y la tool use no se ejecuta. No se produce ninguna acción en el filesystem.
- **RN-T2: Cierre de chat interrumpe streaming.** Si el usuario cierra un chat mientras el agente está en estado `typing_response`, el streaming se interrumpe de forma inmediata. No hay espera.
- **RN-T3: Sin ANTHROPIC_API_KEY.** El backend nunca hereda la variable `ANTHROPIC_API_KEY` al spawnear procesos Claude Code. Si está presente en el entorno, la apertura de sesión falla con mensaje claro al usuario.
- **RN-T4: Aislamiento de sesiones.** Las sesiones son completamente independientes entre sí. Un error, cierre o estado de una sesión no afecta a las demás.
- **RN-T5: sessionId como discriminador único.** El identificador de sesión es el `sessionId`, no el `agentId`. Múltiples sesiones del mismo agente son posibles y se diferencian únicamente por `sessionId`.
- **RN-T6: NPC solo existe mientras hay chat activo.** No hay NPCs en el mapa sin una sesión de chat activa asociada. La única excepción son los elementos ambientales estáticos del mapa (cafetera, plantas, etc.).
- **RN-T7: Carpeta de trabajo es inmutable durante la sesión.** Una vez confirmada la carpeta al abrir el chat, no puede cambiarse sin cerrar y reabrir la sesión.

## Features del MVP

| ID | Feature | US relacionadas | Estado |
|----|---------|-----------------|--------|
| F-01 | Apertura de chat con selección de carpeta | US-01 | Listo para refinement |
| F-02 | Conversación con agente (streaming) | US-02 | Listo para refinement |
| F-03 | Aprobación/rechazo de tool use | US-03 | Listo para refinement |
| F-04 | Cierre de chat | US-04 | Listo para refinement |
| F-05 | Terminal embebida — tab Agente (observer) | US-05 | Listo para refinement |
| F-06 | Terminal embebida — tab Bash (shell interactiva) | US-06 | Listo para refinement |
| F-07 | Múltiples chats en paralelo | US-07 | Listo para refinement |
| F-08 | Customización de NPC | US-08 | Listo para refinement |
| F-09 | Agregar personaje custom | US-09 | Listo para refinement |

## Fuera de alcance del MVP

- Persistencia de conversaciones entre sesiones.
- Aprobaciones automáticas / allow-lists de tools.
- Editor de mapa (escritorios son fijos en MVP, expandible para personajes custom).
- Avatar humano controlable por el usuario.
- Multi-usuario o uso en red.
- Orquestación automática multi-agente (sala de reuniones es decorativa en MVP).
- Empaquetado como app Electron.
- Eliminación de agentes custom desde la UI (puede ser mejora post-MVP).
- Historial de carpetas usadas recientemente.
- Persistencia del log de tool calls entre sesiones.
