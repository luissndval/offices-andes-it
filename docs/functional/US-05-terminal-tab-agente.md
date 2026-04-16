# US-05: Ver y usar la terminal embebida — tab Agente (observer de tool calls)

**ID**: AB#<a asignar>
**Feature padre**: F-05 — Terminal embebida — tab Agente (observer)
**Épica**: AB#<a asignar> — Agent Workbench MVP
**Tipo**: Funcional
**Prioridad**: Must
**Estimación**: <SP, a completar por el equipo>

## Historia

Como **usuario desarrollador**,
quiero **ver en tiempo real todos los tool calls que el agente ejecuta, con sus parámetros y resultados**,
para **auditar el trabajo del agente y entender exactamente qué está haciendo en mi filesystem**.

## Contexto

Dentro de cada chat existe una terminal embebida con dos pestañas. La tab "Agente" es un observer de solo lectura que muestra el flujo completo de tool calls de esa sesión: qué herramientas usó el agente, con qué parámetros, y cuál fue el resultado de cada una. No es una terminal interactiva: el usuario no puede escribir en ella. Su propósito es dar visibilidad total de la actividad del agente, complementando el historial de chat que muestra los mensajes de texto. La información que aparece aquí es la misma que pasa por el mecanismo de aprobación de US-03, pero presentada de forma cronológica y persistente durante la sesión.

## Reglas de negocio

- RN1: La tab Agente es estrictamente de solo lectura. El usuario no puede escribir ni ejecutar comandos en ella.
- RN2: Toda tool use de la sesión queda registrada en la tab Agente de forma cronológica, incluyendo las rechazadas por el usuario.
- RN3: Cada entrada en la tab Agente muestra como mínimo: nombre de la herramienta, parámetros usados, estado (pendiente / ejecutada / rechazada) y resultado (si fue ejecutada).
- RN4: Los resultados de las tool uses pueden ser extensos; deben ser plegables para no saturar la vista.
- RN5: La tab Agente solo muestra datos de la sesión activa actual. Al cerrar el chat, el historial desaparece.
- RN6: Los tool calls aparecen en la tab Agente en el mismo momento en que son procesados por el sistema, no solo cuando el agente termina de responder.

## Criterios de aceptación

### Escenario 1: El agente ejecuta una tool use aprobada y aparece en la tab (happy path)

```gherkin
Dado que el usuario tiene un chat abierto con el agente "Tech Lead"
Y la tab "Agente" de la terminal embebida está visible
Cuando el agente ejecuta la herramienta "Read" sobre "src/auth/login.ts" con aprobación del usuario
Entonces la tab "Agente" muestra una nueva entrada con la herramienta "Read", el archivo "src/auth/login.ts" y el contenido devuelto
Y la entrada queda marcada como "ejecutada"
Y la entrada es plegable para ocultar el contenido del archivo si es extenso
```

### Escenario 2: Una tool use rechazada también aparece en la tab (alternativo)

```gherkin
Dado que el agente "Tech Lead" solicitó ejecutar "Write" sobre "src/config/env.ts"
Y el usuario rechazó la solicitud
Entonces la tab "Agente" muestra una entrada para esa tool use con estado "rechazada"
Y la entrada indica que la herramienta no se ejecutó
```

### Escenario 3: El usuario navega entre la tab Agente y la tab Bash sin perder contenido (alternativo)

```gherkin
Dado que la tab "Agente" muestra 5 tool calls registrados
Cuando el usuario cambia a la tab "Bash" y luego vuelve a la tab "Agente"
Entonces los 5 tool calls siguen visibles y en el mismo estado
```

### Escenario 4: El usuario intenta escribir en la tab Agente (error)

```gherkin
Dado que la tab "Agente" está activa
Cuando el usuario intenta escribir cualquier texto en la terminal
Entonces el sistema no registra ningún input
Y la tab permanece en modo lectura sin ninguna modificación
```

### Escenario 5: La sesión tiene muchos tool calls y el rendimiento se degrada (error)

```gherkin
Dado que la sesión acumuló más de 50 entradas de tool calls en la tab "Agente"
Cuando el agente ejecuta una herramienta adicional
Entonces la nueva entrada aparece correctamente en la tab
Y la tab sigue siendo usable sin bloqueos visibles
```

## Dependencias

- **Funcionales**: US-01 (sesión activa), US-03 (tool uses que se registran en la tab).
- **Técnicas**: los eventos `tool_request`, `tool_result` del protocolo WebSocket deben alimentar también la tab Agente además del flujo de aprobación; componente de terminal embebida read-only en el frontend.
- **De diseño**: diseño de la tab Agente dentro de la terminal embebida; diseño de entradas de tool call con estado y contenido plegable; diferenciación visual entre estados "ejecutada", "rechazada" y "pendiente".

## Fuera de alcance

- Exportar o copiar el log de tool calls a un archivo.
- Filtrar o buscar dentro del log de tool calls.
- Persistencia del log entre sesiones.
- Diferenciación de colores por tipo de herramienta (puede ser mejora futura).

## Notas para UX/UI

La tab Agente no es una terminal clásica con cursor: es un log estructurado de herramientas. Su diseño debe distinguirla visualmente de la tab Bash (que sí tiene cursor y es interactiva) para evitar confusión. Las entradas deben mostrar un indicador temporal (al menos hora de ejecución) para dar contexto de cuándo ocurrió cada acción.

## Notas para Tech Lead

- Esta tab consume los mismos eventos WebSocket (`tool_request`, `tool_result`) que el sistema de aprobación de US-03. El frontend debe fan-out esos eventos tanto al mecanismo de aprobación como al log de la tab Agente.
- El límite de entradas mostradas simultáneamente debe definirse para evitar problemas de rendimiento en sesiones largas. Ver Q-10.

## Métricas de éxito

- Porcentaje de sesiones en las que el usuario abre la tab Agente al menos una vez.

## Preguntas abiertas

- [ ] Q-10: ¿Hay un límite máximo de tool calls que la tab Agente retiene en memoria durante una sesión? ¿Se trunca el histórico o se acumula todo?
- [ ] Q-11: ¿Las tool calls que se muestran en la tab Agente incluyen el output completo (potencialmente extenso) o solo una versión resumida con opción de expandir?
