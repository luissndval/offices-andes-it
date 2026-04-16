# Documentación Funcional — Agent Workbench MVP

Última actualización: 2026-04-16

Este directorio contiene la documentación funcional completa del MVP de Agent Workbench: épica, features, User Stories y preguntas abiertas al PO.

---

## Épica

| Archivo | Descripción |
|---------|-------------|
| [epic.md](./epic.md) | Épica completa del MVP: descripción, objetivo, actores, restricciones, reglas transversales y tabla de features. |

---

## User Stories

| ID | Archivo | Feature | Prioridad | Estado |
|----|---------|---------|-----------|--------|
| US-01 | [US-01-abrir-chat-con-agente.md](./US-01-abrir-chat-con-agente.md) | F-01 — Apertura de chat con selección de carpeta | Must | Listo para refinement |
| US-02 | [US-02-conversar-con-agente.md](./US-02-conversar-con-agente.md) | F-02 — Conversación con agente (streaming) | Must | Listo para refinement |
| US-03 | [US-03-aprobar-rechazar-tool-use.md](./US-03-aprobar-rechazar-tool-use.md) | F-03 — Aprobación/rechazo de tool use | Must | Listo para refinement |
| US-04 | [US-04-cerrar-chat.md](./US-04-cerrar-chat.md) | F-04 — Cierre de chat | Must | Listo para refinement |
| US-05 | [US-05-terminal-tab-agente.md](./US-05-terminal-tab-agente.md) | F-05 — Terminal embebida tab Agente (observer) | Must | Listo para refinement |
| US-06 | [US-06-terminal-tab-bash.md](./US-06-terminal-tab-bash.md) | F-06 — Terminal embebida tab Bash (shell interactiva) | Must | Listo para refinement |
| US-07 | [US-07-multiples-chats-en-paralelo.md](./US-07-multiples-chats-en-paralelo.md) | F-07 — Múltiples chats en paralelo | Must | Listo para refinement |
| US-08 | [US-08-customizar-npc.md](./US-08-customizar-npc.md) | F-08 — Customización de NPC | Should | Listo para refinement |
| US-09 | [US-09-agregar-personaje-custom.md](./US-09-agregar-personaje-custom.md) | F-09 — Agregar personaje custom | Should | Listo para refinement |

### Leyenda de estados

| Estado | Significado |
|--------|-------------|
| Borrador | En redacción, no revisada |
| Listo para refinement | Cumple DoR preliminar, pendiente de resolución de preguntas abiertas y estimación |
| Ready | DoR completa: preguntas cerradas, mockups aprobados, estimada |
| En sprint | En desarrollo |
| Completada | DoD cumplida |

---

## Preguntas abiertas al PO

Ver [open-questions.md](./open-questions.md) para la lista completa de ambigüedades funcionales que deben resolverse antes del Sprint Planning.

**Total de preguntas abiertas**: 21

**Preguntas que bloquean el refinement de Must-stories**:
- Q-02: implementación del selector de carpeta (afecta US-01, la entrada al sistema).
- Q-03: ubicación del system prompt (afecta US-01, US-09).
- Q-06: comportamiento de Claude Code tras un rechazo de tool use (afecta US-03).
- Q-08: confirmación al cerrar chat con agente ocupado (afecta US-04).
- Q-15: ubicación de NPCs con más de 8 chats activos (afecta US-07 y la arquitectura del mapa).

---

## Dependencias entre User Stories

```
US-01 (abrir chat)
  └── US-02 (conversar)
        └── US-03 (aprobar tool use)
  └── US-04 (cerrar chat)       ← aplica a cualquier estado de US-02/US-03
  └── US-05 (tab Agente)        ← consume eventos de US-03
  └── US-06 (tab Bash)          ← usa la carpeta de US-01 como cwd
  └── US-07 (múltiples chats)   ← US-01 a US-06 deben funcionar por sesión

US-08 (customizar NPC)          ← independiente, mejora visual
US-09 (agregar agente custom)
  └── US-01 (el agente custom se usa igual que los predefinidos)
  └── US-08 (la customización aplica a agentes custom también)
```

---

## Reglas de negocio transversales

Documentadas en [epic.md](./epic.md), sección "Reglas de negocio transversales". Resumen:

| ID | Regla |
|----|-------|
| RN-T1 | Cierre de chat con tool use pendiente: se cierra sin ejecutar la tool. |
| RN-T2 | Cierre de chat con streaming activo: se interrumpe inmediatamente. |
| RN-T3 | ANTHROPIC_API_KEY nunca se hereda al spawnear Claude Code. |
| RN-T4 | Aislamiento total entre sesiones: errores de una no afectan a otras. |
| RN-T5 | sessionId es el discriminador único de sesión, no agentId. |
| RN-T6 | NPC solo existe mientras hay chat activo asociado. |
| RN-T7 | La carpeta de trabajo es inmutable durante la vida de una sesión. |
