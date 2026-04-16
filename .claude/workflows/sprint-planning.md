# Workflow: Sprint Planning

> **Objetivo**: definir qué se va a hacer en el sprint y cómo.

## Cuándo
Día 1 del sprint. Duración: 2-4 horas según largo del sprint.

## Participantes
Todo el equipo. PO obligatorio para parte 1.

## Entrada
- Backlog priorizado y refinado (US en estado **Approved** en Azure DevOps).
- Velocity histórica del equipo.
- Capacidad del sprint (días disponibles por persona).

## Estructura

### Parte 1 — Qué (driven by PO)
1. PO presenta el **objetivo del sprint** (Sprint Goal).
2. PO propone US candidatas en orden de prioridad.
3. Equipo selecciona qué entra al sprint hasta llenar la capacidad.

### Parte 2 — Cómo (driven by equipo)
4. Por cada US seleccionada, el equipo:
   - Confirma que cumple DoR.
   - La descompone en **tasks técnicas** (Azure DevOps tasks).
   - Asigna ownership tentativo.
   - Identifica bloqueos potenciales.

## Cadena de agentes

### Para definir el Sprint Goal
**Agente**: `@product-owner`
```bash
opencode run "@product-owner proponé el Sprint Goal del próximo sprint \
  basado en las features priorizadas AB#101, AB#102 y AB#103."
```

### Para descomponer cada US en tasks
**Agentes**: `@tech-lead` + `@dev-backend` + `@dev-frontend-mobile` + `@devops`

```bash
opencode run "@tech-lead descomponé la US AB#1234 en tasks técnicas, \
  diferenciando backend, mobile e infra. Estimá horas por task."
```

```bash
opencode run "@dev-backend revisá las tasks de AB#1234 que te tocan, \
  validá la estimación y agregá tasks faltantes si las hay."
```

```bash
opencode run "@dev-frontend-mobile mismo ejercicio para las tasks mobile."
```

```bash
opencode run "@devops si AB#1234 requiere cambios de pipeline o infra, \
  proponé las tasks correspondientes."
```

### Para validar capacidad
**Agente**: `@product-owner` o `@tech-lead` (rotativo)

Calcular: `suma(SP de US elegidas) ≤ velocity_promedio * factor_seguridad (0.8)`.

Si pasa, el sprint se "compromete". Si no, se quita la US de menor prioridad.

## Output del Planning
- Sprint Goal escrito y visible.
- Sprint Backlog cargado en Azure Boards (US en estado **Committed**).
- Tasks creadas y asignadas.
- Riesgos del sprint identificados (lista corta).

## Antipatrones
- Comprometer al 100% de la capacidad → sin margen para imprevistos.
- Aceptar US que no cumplen DoR "porque ya las refinamos" → no, vuelven a backlog.
- Tasks de "investigar" en sprint productivo → eso es un spike, va separado.
- Sprint Goal del tipo "terminar lo del sprint pasado" → no es un goal, es un retraso.
