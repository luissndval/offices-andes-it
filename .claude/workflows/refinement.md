# Workflow: Refinement

> **Objetivo**: dejar US listas (cumpliendo DoR) para ser tomadas en el próximo Sprint Planning.

## Cuándo
Al menos 1 vez por sprint, idealmente a mitad de sprint.

## Participantes
- PO (driver)
- Analista Funcional (driver)
- Tech Lead
- UX/UI (si la US tiene UI)
- 1-2 devs (back y/o front según corresponda)
- QA

## Cadena de agentes

```
PO → Analista Funcional → UX/UI → Tech Lead → QA → PO (validación final)
```

## Paso a paso

### 1. PO prepara épicas y features candidatas
**Agente**: `@product-owner`
**Input**: objetivos del trimestre, métricas, feedback de usuarios.
**Output**: lista priorizada de features con valor de negocio claro.

```bash
opencode run "@product-owner armá la próxima tanda de refinement: \
  tomá las features de la épica AB#100 y proponé el orden de refinement \
  considerando dependencias y valor."
```

### 2. Analista Funcional escribe las US
**Agente**: `@analista-funcional`
**Input**: feature del PO + contexto de épica.
**Output**: US completas con CA en Gherkin (template `templates/user-story.md`).

```bash
opencode run "@analista-funcional escribí las US para la feature AB#101. \
  Asegurate de cubrir happy path, alternativos y errores."
```

### 3. UX/UI agrega especificación visual
**Agente**: `@ux-ui`
**Input**: US del AF.
**Output**: flujo + spec de pantallas + accesibilidad documentada.

```bash
opencode run "@ux-ui revisá la US AB#1234 y proponé el flujo de pantallas \
  con sus estados (loading/vacío/error/éxito)."
```

### 4. Tech Lead evalúa diseño técnico
**Agente**: `@tech-lead`
**Input**: US + spec UX.
**Output**: diseño técnico, ADR si aplica, tareas técnicas sugeridas, riesgos.

```bash
opencode run "@tech-lead diseñá técnicamente la US AB#1234. \
  Si requiere decisiones de arquitectura, generá un ADR."
```

### 5. QA prepara plan de pruebas
**Agente**: `@qa-tester`
**Input**: US con CA + spec UX + diseño técnico.
**Output**: plan de pruebas inicial con casos derivados de CA + bordes.

```bash
opencode run "@qa-tester generá el plan de pruebas para AB#1234, \
  incluí casos de borde y candidatos a automatización."
```

### 6. PO valida que cumple DoR
**Agente**: `@product-owner`
**Input**: la US enriquecida por todos los anteriores.
**Output**: ✅ lista para Planning, ⚠️ ajustes necesarios, o ❌ rechazada.

```bash
opencode run "@product-owner validá que AB#1234 cumple la Definition of Ready."
```

## Criterio de salida
Una US sale de refinement cuando **todos los items de `shared/definition-of-ready.md` están en verde**.

## Antipatrones a evitar
- "La estimamos después en Planning" → no, sin estimación no entra a Ready.
- "Los mockups los hace UX cuando empiece el sprint" → no, sin mockups no entra a Ready.
- "El PO confirma después" → no, sin confirmación no entra a Ready.
- US gigantes que el equipo no quiere partir por flojera de redactarlas → siempre se parten.
