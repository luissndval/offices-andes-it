# Tech Stack

> Este archivo lo lee TODO agente. Si cambia el stack, se actualiza acá una sola vez.

## Mobile

**Estado**: a definir por el Tech Lead en el primer spike de arquitectura.

Opciones contempladas:
- **React Native** (Expo o bare) — preferido si hay equipo con experiencia en React.
- **Flutter** — preferido si se busca máxima consistencia visual cross-platform.
- **Nativo** (Swift + Kotlin) — preferido si hay requisitos fuertes de performance, hardware o features muy específicos de plataforma.

**Criterios de decisión** (los completa el Tech Lead en un ADR):
- [ ] Skills del equipo
- [ ] Performance requerida
- [ ] Acceso a APIs nativas
- [ ] Time-to-market
- [ ] Mantenimiento a largo plazo

## Backend

**Default propuesto** (ajustar según decisión del Tech Lead):
- **Node.js + TypeScript** con **NestJS** o **Fastify**.
- **PostgreSQL** como DB principal.
- **Redis** para cache y colas livianas.
- Hostado en **Azure App Service** o **Azure Container Apps**.

## Infraestructura

- **Cloud**: Azure (alineado con Azure DevOps).
- **CI/CD**: Azure Pipelines.
- **Repos**: Azure Repos (Git).
- **Tracking**: Azure Boards.
- **Artefactos**: Azure Artifacts.
- **Secrets**: Azure Key Vault.
- **Observabilidad**: Application Insights.

## Convenciones cross-cutting

- **Branching**: trunk-based con feature branches cortas: `feature/AB-1234-descripcion-corta`.
- **Commits**: Conventional Commits con ID de work item al final:
  ```
  feat(login): agregar login biométrico AB#1234
  fix(checkout): corregir cálculo de impuestos AB#1567
  ```
- **Versionado**: SemVer (`MAJOR.MINOR.PATCH`).
- **Idiomas**:
  - Código, commits, PRs, comentarios técnicos → **inglés**.
  - User stories, criterios de aceptación, documentación funcional → **español**.
- **PRs**: máximo 400 líneas cambiadas. Si supera, se parte.
