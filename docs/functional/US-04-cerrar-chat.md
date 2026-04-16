# US-04: Cerrar un chat

**ID**: AB#<a asignar>
**Feature padre**: F-04 — Cierre de chat
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **cerrar el chat de un agente cuando ya no lo necesito**,
para **liberar recursos y mantener el mapa limpio con solo los agentes activos**.

## Contexto

Cada chat abierto corresponde a un proceso real de Claude Code corriendo en el backend y a un NPC visible en el mapa. Cerrar el chat es la acción de finalizar esa sesión: el proceso se termina, el escritorio queda libre y el NPC desaparece del mapa. El cierre puede ocurrir en cualquier momento, incluso si el agente está en medio de una respuesta o esperando aprobación de una tool use. La premisa central del sistema es que no hay NPCs sin chat asociado, por lo que el cierre del chat siempre implica la desaparición del NPC.

## Reglas de negocio

- RN1: Cerrar un chat siempre termina el proceso subyacente de Claude Code de esa sesión, sin excepción.
- RN2: Si hay una tool use pendiente de aprobación al momento del cierre, la sesión se cierra igualmente sin ejecutar la tool use.
- RN3: Si el agente está generando una respuesta en streaming al momento del cierre, el streaming se interrumpe y la respuesta parcial queda en el historial como incompleta (aunque el historial desaparece al cerrarse el chat).
- RN4: El NPC del agente desaparece del mapa al completarse el cierre de la sesión.
- RN5: El escritorio que ocupaba el NPC queda disponible para una nueva sesión del mismo u otro agente.
- RN6: El cierre es inmediato desde la perspectiva del usuario; el backend intenta terminar el proceso con SIGTERM y, si no responde, lo fuerza con SIGKILL.
- RN7: Si el agente está en estado `thinking` o `typing_response` al momento del cierre, no se solicita confirmación adicional al usuario (el cierre es directo). Ver pregunta abierta Q-08.

## Criterios de aceptación

### Escenario 1: Cierre de un chat con agente en estado idle (happy path)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y el agente "Tech Lead" está en estado "idle"
Cuando el usuario cierra el chat
Entonces el proceso de Claude Code de esa sesión se termina
Y el NPC "Tech Lead" desaparece del mapa
Y el chat deja de estar visible
Y el escritorio del "Tech Lead" queda disponible en el mapa
```

### Escenario 2: Cierre de un chat mientras el agente está respondiendo (alternativo)

```gherkin
Dado que el agente "Tech Lead" está generando una respuesta en streaming
Y el NPC muestra estado "typing_response"
Cuando el usuario cierra el chat
Entonces el streaming se interrumpe inmediatamente
Y el proceso de Claude Code se termina
Y el NPC "Tech Lead" desaparece del mapa
```

### Escenario 3: Cierre de un chat con tool use pendiente de aprobación (alternativo)

```gherkin
Dado que el agente "Dev Backend" tiene una solicitud de tool use pendiente de aprobación
Y el NPC muestra estado "waiting_approval"
Cuando el usuario cierra el chat
Entonces la tool use no se ejecuta
Y el proceso de Claude Code se termina
Y el NPC "Dev Backend" desaparece del mapa
Y no se produce ninguna acción en el filesystem derivada de esa tool use
```

### Escenario 4: El proceso del agente ya terminó antes de que el usuario cierre el chat (error)

```gherkin
Dado que el proceso de Claude Code de la sesión "Tech Lead" terminó de forma inesperada
Y el NPC muestra estado "error"
Cuando el usuario cierra el chat
Entonces el sistema reconoce que el proceso ya no está activo
Y el NPC "Tech Lead" desaparece del mapa
Y el chat deja de estar visible sin emitir un error adicional al usuario
```

### Escenario 5: El backend no puede terminar el proceso en tiempo razonable (error)

```gherkin
Dado que el usuario cierra el chat del agente "DevOps"
Y el proceso de Claude Code no responde al SIGTERM en el tiempo esperado
Entonces el backend envía SIGKILL al proceso
Y la sesión se cierra forzosamente
Y el NPC "DevOps" desaparece del mapa
Y el sistema registra internamente el cierre forzoso
```

## Dependencias

- **Funcionales**: US-01 (la sesión debe existir para poder cerrarse); aplica a cualquier estado de sesión cubierto en US-02 y US-03.
- **Técnicas**: manejo de señales SIGTERM/SIGKILL sobre el proceso Claude Code; limpieza del estado Zustand en el frontend al recibir `session_closed`; actualización del mapa al desaparecer el NPC.
- **De diseño**: animación de fade-out del NPC al cerrarse el chat; indicación visual del cierre en la ventana del chat.

## Fuera de alcance

- Confirmación de cierre (dialog "¿estás seguro?") — ver pregunta abierta Q-08.
- Persistencia del historial de chat antes de cerrar.
- Posibilidad de "pausar" una sesión sin cerrarla.
- Reconexión automática a una sesión cerrada.

## Notas para UX/UI

Evaluar si el cierre desde el mapa (click sobre el NPC) debe comportarse igual que el cierre desde la ventana de chat. Ver pregunta abierta Q-09.

## Notas para Tech Lead

- El backend debe manejar el caso en que `session_closed` llegue mientras hay un `tool_request` en vuelo: debe cancelar la espera y terminar el proceso limpiamente.
- El tiempo máximo entre SIGTERM y SIGKILL debe definirse como constante con nombre (no magic number).
- El `session_closed` del servidor al cliente debe emitirse solo cuando el proceso efectivamente terminó, no cuando se inició el cierre.

## Métricas de éxito

- Porcentaje de cierres de sesión que completan sin necesidad de SIGKILL.
- Tiempo promedio de cierre de sesión desde la acción del usuario hasta el evento `session_closed`.

## Preguntas abiertas

- [ ] Q-08: ¿Debe el sistema pedir confirmación cuando el usuario cierra un chat con el agente ocupado (respondiendo o esperando aprobación), o el cierre es siempre directo?
- [ ] Q-09: ¿Se puede cerrar el chat directamente desde el mapa haciendo alguna acción sobre el NPC, o solo desde la ventana de chat?
