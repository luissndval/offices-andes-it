# Preguntas abiertas al PO — Agent Workbench MVP

Todas las preguntas listadas acá son ambigüedades funcionales detectadas durante el análisis. No tienen respuesta inventada. Deben resolverse con el PO antes del Sprint Planning para que las User Stories afectadas alcancen la Definition of Ready.

Cada pregunta está vinculada a la US que la originó. Si se resuelve, actualizar el campo correspondiente en la US y mover la pregunta a la sección "Resueltas" al final de este documento.

---

## Bloque 1 — Apertura de chat y gestión de sesiones

### Q-01 (US-01)
¿Se permite abrir múltiples instancias del mismo agente en paralelo (por ejemplo, dos sesiones de "Dev Backend" al mismo tiempo)?
Si la respuesta es sí:
- ¿Cómo se diferencian visualmente los dos NPCs en el mapa (mismo sprite con badge de número, colores distintos, nombre con sufijo)?
- ¿Pueden ocupar el mismo escritorio o se asignan escritorios distintos?

### Q-02 (US-01)
¿El selector de carpeta al abrir un chat es un explorador de archivos nativo del OS (dialog del sistema), un input de texto libre con validación, o un componente personalizado dentro de la aplicación?
Si es nativo: ¿cómo se implementa desde una app web local sin Electron?
¿Debe mostrar historial de rutas usadas recientemente?

### Q-03 (US-01)
¿El system prompt del agente se busca en la carpeta de trabajo elegida (`.claude/agents/<id>.md`) o en una ubicación central del repositorio de Agent Workbench?
¿Qué pasa si la carpeta elegida no tiene ese archivo pero existe uno en la ubicación central de la app?
¿Se pueden usar las dos fuentes con un orden de prioridad?

---

## Bloque 2 — Conversación y streaming

### Q-04 (US-02)
¿El sistema hace cola de mensajes del usuario o simplemente bloquea el envío mientras el agente está ocupado?
Si hay cola: ¿cuál es el límite de mensajes en cola? ¿El usuario ve que hay mensajes encolados?
Si no hay cola: ¿el mensaje simplemente se descarta o se muestra como "pendiente"?

### Q-05 (US-02)
¿El timeout de 60 segundos sin respuesta del agente es configurable (por usuario, por agente, o de forma global) o es un valor fijo?
Si es configurable, ¿dónde se configura?

---

## Bloque 3 — Tool use y aprobación

### Q-06 (US-03)
¿Qué hace Claude Code cuando recibe un rechazo de tool use? ¿Puede continuar respondiendo sin ejecutar la herramienta, o la conversación queda en un estado irrecuperable que obliga al usuario a cerrar el chat?
La respuesta afecta directamente el mensaje que se muestra al usuario tras rechazar.

### Q-07 (US-03)
¿El resultado (output) de una tool use ejecutada debe mostrarse en el chat siempre visible o solo disponible detrás de un expand?
¿Hay un límite de caracteres/bytes del output que se muestra? ¿Qué pasa si el output es muy grande (ej: leer un archivo de 500KB)?

---

## Bloque 4 — Cierre de chat

### Q-08 (US-04)
¿Debe el sistema pedir confirmación cuando el usuario cierra un chat con el agente en estado activo (respondiendo o con tool use pendiente)?
¿O el cierre es siempre inmediato sin confirmación, independientemente del estado del agente?

### Q-09 (US-04)
¿Se puede cerrar un chat directamente desde el mapa mediante alguna acción sobre el NPC (ej: click derecho → cerrar, o algún botón que aparece al hacer hover)?
¿O el cierre solo es posible desde la ventana de chat?

---

## Bloque 5 — Terminal embebida

### Q-10 (US-05)
¿Hay un límite máximo de entradas de tool calls que la tab Agente retiene en memoria durante una sesión (ej: las últimas 100)?
Si la sesión supera ese límite, ¿se trunca el histórico (se pierden las más antiguas) o se acumula todo indefinidamente?

### Q-11 (US-05)
¿El output de una tool use en la tab Agente se muestra completo o resumido?
Si es completo y es muy extenso (ej: lectura de un archivo grande), ¿hay paginación o scroll infinito?
¿O solo se muestra un resumen con opción de expandir?

### Q-12 (US-06)
¿La tab Bash usa la shell default del usuario (bash, zsh, fish, según la configuración del OS) o una shell fija (ej: bash) sin importar la configuración?
¿Cómo se determina esto en entornos Windows?

### Q-13 (US-06)
¿La shell de la tab Bash hereda el entorno completo del proceso del backend (incluyendo PATH custom, NVM, rbenv, etc.) o solo un entorno mínimo?
Esto afecta si el usuario puede usar herramientas instaladas vía nvm, pyenv, etc. directamente desde la tab Bash.

---

## Bloque 6 — Múltiples chats

### Q-14 (US-07)
Si el usuario tiene dos sesiones del mismo tipo de agente abiertas simultáneamente (ej: dos "Dev Backend"), ¿cómo se diferencian visualmente?
Opciones posibles: badge numérico sobre el NPC, nombre con sufijo automático, color distinto. ¿Cuál es la elección del PO?

### Q-15 (US-07)
El mapa tiene 8 escritorios fijos. Si el usuario abre más de 8 chats (el límite es 10), ¿dónde se ubican los NPCs que exceden los escritorios disponibles?
Opciones: se generan posiciones dinámicas en el mapa, el límite real se reduce a 8 por restricción del mapa, o se amplía el mapa.
Esta decisión afecta tanto funcional como técnicamente.

---

## Bloque 7 — Customización y personajes custom

### Q-16 (US-08)
¿Las customizaciones de NPC (nombre display, ropa, color) se guardan en un archivo local en la máquina del usuario (ej: `~/.agent-workbench/config.json`), en el localStorage del browser, o en un archivo dentro del proyecto Agent Workbench?
¿Deben ser globales a la instalación (afectan a todos los proyectos) o por carpeta de trabajo?

### Q-17 (US-08)
¿Las variantes de ropa del proyecto base pablodelucca/pixel-agents incluyen las animaciones completas (idle, typing, waiting) para cada variante?
¿Todas las combinaciones de variante + color están disponibles? ¿O hay restricciones en las combinaciones posibles?

### Q-18 (US-09)
¿El nombre display de un agente custom debe ser único a nivel global (incluyendo agentes predefinidos)? ¿O se permiten duplicados y se diferencian por `agentId`?

### Q-19 (US-09)
El mapa tiene 8 escritorios fijos y hay 8 agentes predefinidos. Si el usuario crea agentes custom, ¿cómo se les asigna un escritorio?
¿Se generan escritorios dinámicamente en el mapa? ¿Hay un límite total de agentes registrados (no solo simultáneos)?
Esta pregunta está relacionada con Q-15.

### Q-20 (US-09)
¿Se puede eliminar un agente custom desde la UI de la aplicación?
Si el usuario elimina un agente custom que tiene un chat activo en ese momento, ¿qué sucede con esa sesión?
¿Se puede eliminar un agente predefinido?

### Q-21 (US-09)
¿El flujo de carga del archivo `.md` para el system prompt del agente custom soporta drag & drop del archivo sobre la interfaz?
¿O solo el selector de archivo del OS?

---

## Preguntas resueltas

_Ninguna por el momento. Mover acá las preguntas cuando el PO las responda._
