# Workflow: Daily Scrum

> **Objetivo**: sincronizar avance, detectar bloqueos, ajustar plan del día.

## Cuándo
Diario. Mismo horario. **15 minutos máximo**.

## Participantes
Equipo de desarrollo. PO opcional (puede pasar a escuchar).

## Estructura clásica (3 preguntas por persona)
1. ¿Qué hice ayer hacia el Sprint Goal?
2. ¿Qué voy a hacer hoy hacia el Sprint Goal?
3. ¿Qué bloqueos tengo?

> Variante alternativa: walk the board (recorrer el tablero de derecha a izquierda).

## Cadena de agentes (uso opcional)

El daily es de personas, no de agentes. Pero los agentes pueden ayudar **antes** y **después**:

### Antes del daily — preparar reporte propio
Cualquier dev puede pedirle a su agente:

```bash
opencode run "@dev-backend revisá mis commits y PRs de ayer en este repo \
  y armá un resumen de 3 bullets para el daily."
```

### Después del daily — actualizar Azure Boards
Un agente DevOps puede ayudar a sincronizar estados:

```bash
opencode run "@devops actualizá los estados de mis tasks en Azure DevOps \
  según lo que reporté en el daily."
```

⚠️ **Esto requiere integración con Azure DevOps API** y permisos del usuario. Si no tenés MCP configurado para Azure DevOps, lo hacés a mano.

## Output del daily
- Bloqueos identificados con owner para resolverlos.
- Ajustes al plan del día (no al sprint).
- Si surge un riesgo grande para el Sprint Goal: agendar conversación post-daily, **no** extender el daily.

## Antipatrones
- Daily como reporte al manager → es para el equipo.
- Resolver problemas técnicos en el daily → no, post-daily.
- "No tengo nada que decir" → siempre algo: avance, bloqueo, o "todo OK con X".
- Daily de 40 minutos → se cancela y se reprograma estricto a 15.
