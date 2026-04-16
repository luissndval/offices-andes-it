# ADR-003: Estrategia de fork de pixel-agents — GitHub fork vs copia MIT con atribución

**Estado**: Aceptado
**Fecha**: 2026-04-16
**Decisores**: Tech Lead
**Work item**: AB#TBD

## Contexto

Adoptamos pixel-agents (ADR-001). Hay que definir **cómo convive el código ajeno con el nuestro**.

Diferencias fuertes respecto al upstream:
- Upstream: extensión de **VS Code**; deps a `vscode` API; consume JSONL **de disco**.
- Nosotros: **web app standalone**; backend Node.js; consume stream-json **por pipe de stdout**; multi-sesión; terminal embebida; folder picker por chat; custom characters.

Estimamos que el **80% del código de bootstrapping, glue code de VS Code y comandos** no nos sirve, y el **20% útil** (render loop, sprite loader, NPC state machine, paleta pixel-art) queda envuelto en imports de `vscode`.

Hay tres formas de trabajar esto sin violar la MIT.

## Opciones consideradas

### Opción A: Fork en GitHub (`git fork` del repo completo)

**Pros**
- Mantenemos history completa y atribución automática vía git.
- `git pull upstream main` permite tirar cambios nuevos.
- Transparencia total para cualquiera que audite el linaje.

**Contras**
- Heredamos **estructura de extensión VS Code** que vamos a borrar igual.
- El merge de upstream se rompe constantemente (refactors nuestros vs suyos).
- Mental overhead: el repo "se ve" como si fuera una extensión, confunde al equipo.
- CI/CD heredado (package.json, build steps) no aplica y hay que limpiarlo.
- El 80% del código se borra en los primeros commits → el fork pierde sentido rápido.

### Opción B: Copia de archivos MIT con `NOTICE.md` y atribución en headers

**Pros**
- Traemos **sólo lo que usamos** (render loop, sprite atlas, NPC state machine).
- Estructura del repo limpia desde el día 1 (monorepo web, sin cruft de VS Code).
- Commits iniciales del TL dejan claro qué es heredado vs propio.
- Licencia MIT se respeta con `NOTICE.md` + headers por archivo copiado.
- Cero fricción en merges futuros — si algo bueno sale upstream, lo miramos y portamos manualmente.

**Contras**
- Perdemos git history del upstream (pero queda en `NOTICE.md` con links por archivo).
- No hay pull automático; cada incorporación futura es un port manual.
- Requiere disciplina: **todo archivo copiado debe tener header de atribución** mientras no sea reescrito.

### Opción C: Git subtree del upstream

**Pros**
- Mantiene history completo de upstream en un path dado.
- Pull/push selectivos.

**Contras**
- Curva para quien no lo usó; equipo chico, no vale la pena.
- Mismo problema que A — traemos archivos que no usamos.
- Conflictos al hacer split semántico (lo nuestro dentro del subtree).

## Decisión

**Opción B: Copia MIT con atribución**.

Rationale:
1. La divergencia es tan fuerte que el 80% se borra. Mantener el fork sincronizado es trabajo puro sin retorno.
2. El valor real está en **render loop + sprites + state machine**, que son unos pocos archivos.
3. La licencia MIT se cumple con `NOTICE.md` + headers por archivo — limpio y auditable.
4. El equipo se ahorra confusión estructural.

## Consecuencias

### Positivas
- Repo con estructura propia desde el día 1.
- Sin cruft de VS Code.
- Commits iniciales del TL documentan el linaje.

### Negativas / Trade-offs aceptados
- Perdemos `git pull upstream` — hay que chequear manualmente releases de pixel-agents (quarterly sugerido).
- Si upstream libera algo valioso (ej: nuevos sprites, nuevo sistema de animación), la incorporación es port, no merge.
- Obligación de mantener atribución correcta — **bloqueante de PR review**.

### Acciones derivadas
- [ ] Crear `NOTICE.md` en la raíz con atribución completa a pixel-agents (autor, licencia, link, fecha de copia, SHA de upstream en el momento de la copia).
- [ ] Incluir header de atribución MIT en cada archivo portado. Formato:
  ```ts
  /**
   * Portions of this file adapted from pixel-agents by Pablo De Lucca
   * https://github.com/pablodelucca/pixel-agents
   * Licensed under MIT. See NOTICE.md for details.
   */
  ```
- [ ] Lista en `NOTICE.md` de **archivos portados** con SHA upstream de referencia.
- [ ] Bloqueante de PR: cualquier archivo portado sin header se rechaza.
- [ ] Review trimestral de upstream para detectar mejoras portables.

## Referencias
- https://github.com/pablodelucca/pixel-agents/blob/main/LICENSE
- ADR-001
