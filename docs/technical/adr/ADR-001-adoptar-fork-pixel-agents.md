# ADR-001: Adoptar fork de pablodelucca/pixel-agents como base

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead, PO
**Work item**: AB#TBD

## Contexto

Agent Workbench necesita un renderer 2D pixel-art que visualice agentes de Claude Code como NPCs. En `ARCHITECTURE.md` (v0) estaba previsto construirlo from scratch con PixiJS v8, sprites propios y un game loop dedicado.

Se encontró `pablodelucca/pixel-agents` (MIT): extensión de VS Code + React 19 que hace exactamente eso — levanta agentes como NPCs, lee JSONL transcripts de Claude Code, renderiza en Canvas 2D. La mayor parte del trabajo de UX, sprites y loop de animación ya está hecha y probada.

La decisión de producto de adoptarlo ya está tomada. Este ADR documenta **por qué** es razonable y **qué se pierde** al hacerlo.

## Opciones consideradas

### Opción A: Build from scratch con PixiJS v8 (plan original de ARCHITECTURE.md v0)

**Pros**
- Control total del stack y del game loop.
- Tipado completo en TS desde el día cero.
- Sin deuda heredada de decisiones ajenas.
- Libertad de elegir sprites propios y layout del mapa sin legacy.

**Contras**
- 2-4 semanas sólo para tener un NPC animado parado en un escritorio.
- Implementar sprite sheet parsing, tilemap, animación de estado, pathfinding básico.
- Curva de aprendizaje de PixiJS para el equipo.
- Bikeshedding de assets que pixel-agents ya resolvió.

### Opción B: Adoptar pixel-agents (fork o copia con atribución)

**Pros**
- Ahorra 2-4 semanas de foundation work.
- Sprites, paleta y feel pixel-art ya calibrados.
- Patrón de "NPC = agente leyendo transcript" ya implementado.
- MIT license → compatibilidad legal sin fricción.
- Pablodelucca es referente activo en Claude Code community; iteraciones upstream pueden aportar.

**Contras**
- Es **extensión de VS Code**, no web app standalone. Hay que desacoplar el código de la API de VS Code (`vscode.*`).
- Usa Canvas 2D, no PixiJS. Hay que reconciliar con ADR-002.
- React 19 en su estado actual (abril 2026): estable pero con edge cases con librerías no migradas.
- Lee transcripts JSONL **de disco**. Nuestro modelo es stream-json **vía stdout pipe**. Hay que portar el parser.
- Fuerte divergencia futura: upstream evoluciona para VS Code, nosotros para web + multi-chat + terminal embebida. Merge costs crecen.

### Opción C: Adoptar sólo los assets (sprites + tileset) y reescribir el render

**Pros**
- Ahorra lo caro de conseguir (sprites coherentes).
- Libertad total de renderer y arquitectura.
- Sin deuda de código ajeno en el repo.

**Contras**
- Perdemos el patrón de estados NPC ya probado.
- Seguimos necesitando 1-2 semanas de foundation de render.
- Si los sprites tienen convenciones (frames por animación, anchor points), hay que redocumentarlas.

## Decisión

**Adoptamos Opción B** — copia de archivos MIT con atribución (ver ADR-003 para detalle de la estrategia de fork), adaptando la capa de render a nuestro modelo web + multi-sesión.

El tiempo ganado en foundation se invierte en lo diferenciador: folder picker por chat, terminal embebida, customización de personajes.

## Consecuencias

### Positivas
- MVP funcional de mapa + NPC animado en días, no semanas.
- Baseline visual profesional desde el día 1.
- Compatibilidad con sprites del ecosistema de pixel-agents.

### Negativas / Trade-offs aceptados
- Heredamos Canvas 2D en vez de PixiJS (ver ADR-002).
- Heredamos React 19; si aparece bug bloqueante, pinning manual a 18.x.
- El código base no estaba pensado para multi-sesión concurrente. Hay que refactorizar el estado global (ver `architecture-overview.md`).
- Mantener pull de upstream requiere estrategia clara (ver ADR-003).

### Acciones derivadas
- [ ] Resolver ADR-002 (renderer) antes de empezar a portar código.
- [ ] Resolver ADR-003 (estrategia de fork) antes del primer commit con código ajeno.
- [ ] Spike de 2 días: desacoplar pixel-agents de la API de VS Code (ver `risks-and-spikes.md`).
- [ ] Actualizar `ARCHITECTURE.md` v0 → referenciar `docs/technical/architecture-overview.md` como fuente de verdad.
- [ ] Incluir `NOTICE.md` con atribución MIT en la raíz del repo.

## Referencias
- https://github.com/pablodelucca/pixel-agents (MIT)
- `ARCHITECTURE.md` v0 (sección 3 — Stack tecnológico)
- `docs/technical/architecture-overview.md`
- ADR-002, ADR-003
