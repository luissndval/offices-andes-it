# Azure DevOps — Convenciones del equipo

Single source of truth del backlog y del trabajo en curso.

## Jerarquía de work items

```
Epic              → iniciativa de producto (trimestre)
 └── Feature      → capacidad funcional (1-2 sprints)
      └── User Story / PBI → entregable de un sprint
           ├── Task         → trabajo técnico (subdivisión de la US)
           └── Bug          → defecto encontrado
Spike             → investigación timeboxed (no entrega valor directo)
```

## Estados estándar

`New → Approved → Committed → In Progress → In Review → In QA → Done`

- **Approved**: cumple Definition of Ready.
- **Committed**: incluida en un sprint.
- **In Review**: PR abierto, esperando revisión.
- **In QA**: mergeada a `main`, desplegada en QA, esperando validación.
- **Done**: cumple Definition of Done.

## Campos obligatorios por tipo

**User Story / PBI**:
- Title, Description, Acceptance Criteria (Gherkin)
- Story Points
- Area Path, Iteration Path
- Tags (al menos: `mobile`, `backend`, `infra`, etc.)
- Linked Mockups (si tiene UI)
- Parent (Feature o Epic)

**Bug**:
- Title, Repro Steps, System Info, Expected vs Actual
- Severity (1 a 4), Priority (1 a 4)
- Found in Build, Iteration Path
- Screenshot/Video si aplica

**Task**:
- Title, Remaining Work (horas)
- Activity (Development, Testing, Documentation, Deployment)
- Parent (User Story)

## Naming de branches y PRs

- Branch: `feature/AB-1234-descripcion-corta` o `bugfix/AB-1234-descripcion`.
- PR title: `AB-1234: <título de la US o bug>`.
- PR description: usar el template (`templates/pull-request.md`).

## Queries útiles que el equipo mantiene

- `My Active Work`
- `Sprint Backlog`
- `Bugs - Active by Severity`
- `Stories Not Ready` (para refinement)
- `Done This Sprint` (para review)
