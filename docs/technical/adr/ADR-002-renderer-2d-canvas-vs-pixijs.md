# ADR-002: Renderer 2D — Canvas 2D vs PixiJS v8

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

`ARCHITECTURE.md` v0 definió **PixiJS v8** como renderer, razonando por compatibilidad con "Claude Office" (proyecto precursor) y por la asunción de que necesitaríamos game loop complejo.

Al adoptar pixel-agents (ADR-001) cambia la realidad:
- pixel-agents usa **Canvas 2D puro** (no PixiJS).
- Nuestro escenario es ~8 NPCs estáticos en escritorios, animación de burbujas y sprites simples.
- No hay scroll infinito, no hay física, no hay batch rendering de miles de sprites.

Dimensionamos: canvas 1024×640, máximo 10 NPCs simultáneos, animaciones de 4-8 frames por estado, tickers a 30-60 fps.

## Opciones consideradas

### Opción A: Canvas 2D puro (lo que trae pixel-agents)

**Pros**
- **Zero runtime cost extra** — ya está en el DOM.
- Bundle: 0 KB adicionales.
- Debugging trivial: DevTools muestra el canvas y el draw se ve línea por línea.
- Código heredado funciona sin portar.
- API mínima, nadie del equipo se traba aprendiéndolo.

**Contras**
- Sin scene graph: mover el mapa entero implica iterar todo.
- Sin batching: si escala a cientos de sprites, cae la performance.
- Animaciones hechas a mano (delta time, frame counters).

### Opción B: PixiJS v8

**Pros**
- Scene graph con `Container`, layers, transforms.
- Batch rendering vía WebGL → miles de sprites sin caídas.
- Ticker y animación ya resueltos.
- Filtros (glow, outline) baratos.
- Sprites compatibles con ecosistema Phaser/Pixi.

**Contras**
- Bundle: ~350-400 KB min+gzip. En una app local importa menos, pero sigue siendo peso.
- Curva de aprendizaje real para quien no lo usó.
- Hay que **portar** todo lo de pixel-agents (semanas).
- WebGL puede fallar en entornos sin aceleración (menos común, pero pasa).
- Sobre-ingeniería para nuestro caso de uso (10 NPCs).

### Opción C: Híbrido — Canvas 2D para mapa, DOM para UI encima

**Pros**
- Lo que está haciendo pixel-agents de hecho.
- UI de React (ventanas, chat, tooltips) en DOM = accesibilidad gratis.

**Contras**
- No es una alternativa real a A, es más bien un complemento. Va implícito en cualquier decisión.

## Decisión

**Opción A: Canvas 2D** (manteniendo la aproximación híbrida de la Opción C: mapa en canvas, todo lo demás en DOM/React).

Razones:
1. **YAGNI**. 10 NPCs no necesitan WebGL.
2. **Cero migración** — evita rehacer el trabajo de pixel-agents.
3. **Bundle menor** — la app local debe arrancar rápido.
4. **Debugging más simple** — el equipo no es game dev, Canvas 2D es transparente.

Si en el futuro (Fase 5+) necesitamos efectos complejos o escalamos a 50+ NPCs, migrar Canvas → PixiJS es refactor contenido (re-implementar draw loop y sprite loader).

## Consecuencias

### Positivas
- Reducimos riesgo de scope creep del renderer.
- Bundle liviano.
- No hay lock-in de librería en la capa visual.

### Negativas / Trade-offs aceptados
- Divergencia con `ARCHITECTURE.md` v0 — queda superseded.
- Si algún día queremos partículas/glow nativos, vamos a escribirlo a mano o migrar.
- No aprovechamos ecosistema Pixi (filtros, spine, plugins).

### Acciones derivadas
- [ ] Actualizar `ARCHITECTURE.md` v0 sección 3 → Canvas 2D.
- [ ] Documentar el draw loop heredado en `architecture-overview.md`.
- [ ] Plantear como **métrica de warning**: si FPS < 30 con 10 NPCs, revisar decisión.

## Referencias
- `ARCHITECTURE.md` v0 sección 3
- ADR-001
- https://github.com/pablodelucca/pixel-agents
