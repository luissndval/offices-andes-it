# Workflow: Sprint Review + Retrospectiva

> Dos ceremonias distintas, mismo día (último día del sprint).
> **Review** mira el producto. **Retro** mira al equipo.

---

## Sprint Review

### Objetivo
Validar el incremento de producto con stakeholders y PO. Adaptar el backlog según feedback.

### Participantes
Equipo + PO + stakeholders relevantes.

### Estructura
1. **PO recuerda Sprint Goal** y qué se comprometió.
2. **Equipo demuestra** cada US terminada en ambiente de QA o staging.
3. **PO acepta o rechaza** cada US contra los CA.
4. **Stakeholders dan feedback** → se anota como input para refinement.
5. **Estado del backlog**: PO comenta cambios de prioridad.

### Cadena de agentes

#### Preparar la demo
**Agente**: `@dev-backend` o `@dev-frontend-mobile` (según corresponda)

```bash
opencode run "@dev-frontend-mobile preparame el guion de demo para AB#1234. \
  Listá los pasos a mostrar y el resultado esperado de cada uno."
```

#### Validar formalmente
**Agente**: `@product-owner`

```bash
opencode run "@product-owner validá AB#1234 contra sus criterios de aceptación. \
  Generá el veredicto formal."
```

#### Generar release notes del sprint
**Agente**: `@devops`

```bash
opencode run "@devops generá release notes a partir de las US en estado Done \
  del sprint actual."
```

### Output
- Lista de US aceptadas (Done).
- Lista de US rechazadas o con observaciones (vuelven al backlog o se generan tasks).
- Feedback de stakeholders capturado en Azure DevOps.
- Release notes publicadas.

---

## Retrospectiva

### Objetivo
Mejorar la forma de trabajar del equipo. **No** se discute producto.

### Participantes
Equipo. PO opcional según madurez del equipo (algunos equipos lo prefieren sin PO para hablar libre).

### Estructura clásica
Formato simple "Start / Stop / Continue":
- **Start**: ¿qué deberíamos empezar a hacer?
- **Stop**: ¿qué deberíamos dejar de hacer?
- **Continue**: ¿qué está funcionando y queremos sostener?

Otros formatos válidos: 4Ls (Liked/Learned/Lacked/Longed for), Mad/Sad/Glad, Sailboat.

### Cadena de agentes

La retro es de personas. Los agentes pueden ayudar a **preparar datos** y **trackear acciones**:

#### Análisis de métricas del sprint
**Agente**: `@devops` o `@tech-lead`

```bash
opencode run "@devops dame las métricas del último sprint: \
  - Velocity real vs estimada \
  - Cantidad de bugs encontrados (por severidad) \
  - Tiempo promedio de PR open → merge \
  - Builds fallidas en CI"
```

#### Compilar feedback escrito
Si el equipo deja sus puntos en un doc compartido, un agente puede agruparlos:

```bash
opencode run "@product-owner agrupá los puntos de la retro de este doc \
  en categorías (proceso, comunicación, técnico, herramientas) \
  y resaltá los que se repiten."
```

#### Trackear acciones de mejora
Cada retro produce **1-3 acciones máximo**, con owner y deadline.

```bash
opencode run "@devops creá work items de tipo Task en Azure Boards \
  para las siguientes acciones de mejora: <listado>. \
  Asignalas al sprint actual con owner."
```

### Output
- 1-3 acciones concretas con owner y fecha.
- Acciones cargadas como tasks en el sprint que arranca.
- En la próxima retro: revisar si las acciones del ciclo anterior se cumplieron.

### Antipatrones
- Retro que termina sin acciones concretas → fue una catarsis, no una retro.
- 15 acciones para el próximo sprint → no se va a hacer ninguna.
- Hablar de producto → para eso está el Review.
- Misma queja sprint tras sprint sin acción → el equipo dejó de creer en la retro.
