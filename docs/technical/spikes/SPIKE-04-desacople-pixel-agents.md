# SPIKE-04: Desacople de pixel-agents del API de VS Code

**Estado**: Completado (cerrado por limite de tokens del agente; consolidado por el lead sobre el repo clonado).
**Timebox**: 2 días → consumido ~40% antes del corte; cerramos con evidencia suficiente.
**Repo analizado**: `https://github.com/pablodelucca/pixel-agents` @ v1.3.0, commit `main` clonado en `/tmp/pixel-agents`.
**Licencia**: MIT (Copyright (c) 2026 Pablo De Lucca).

## Resumen ejecutivo

- **~55% de pixel-agents es reusable** tras desacople: todo `webview-ui/` (React + Canvas 2D + assets), el motor de render de oficina y la lógica de sprites/personajes.
- **~35% se descarta**: todo `src/` (extension host, ~4500 LOC) está acoplado al API `vscode` y no aplica a una web app standalone.
- **~10% se adapta**: `browserMock.ts` + `vscodeApi.ts` + parte del server Node-side.
- El repo YA tiene una capa `browserMock` para correr el webview fuera de VS Code → **camino de adopción mucho más corto del que se estimó en ADR-001**.
- **Cambio crítico en el enfoque**: pixel-agents es un monitor pasivo (tailea JSONL transcripts después de que Claude escribe). Agent Workbench necesita ser activo (spawnear Claude con stream-json y dialogar). El renderer se reusa, la capa de datos se reescribe.

## Árbol del repo (anotado)

```
pixel-agents/
├── src/                        [DESCARTAR — VS Code extension host, 4488 LOC]
│   ├── extension.ts            activate/deactivate — specific API VS Code
│   ├── PixelAgentsViewProvider.ts  977 LOC, webview provider de VS Code
│   ├── fileWatcher.ts          1369 LOC, tailea ~/.claude/projects/**/*.jsonl
│   ├── transcriptParser.ts     633 LOC, parsea eventos JSONL → estados
│   ├── agentManager.ts         621 LOC, estado de agentes
│   ├── assetLoader.ts          532 LOC, lee assets desde disk via vscode.Uri
│   ├── timerManager.ts         152 LOC
│   ├── layoutPersistence.ts    201 LOC (usa vscode.workspace.fs)
│   ├── configPersistence.ts     50 LOC (idem)
│   ├── constants.ts             23 LOC
│   └── types.ts                 80 LOC
│
├── server/src/                 [REVISAR — 1 import vscode, resto Node puro]
│   ├── server.ts               MCP/hook server
│   ├── hookEventHandler.ts     único archivo con `import vscode` en server/
│   ├── provider.ts
│   ├── providers/
│   ├── teamProvider.ts
│   └── teamUtils.ts
│
├── webview-ui/                 [REUSAR — React 19 + Canvas 2D, ~3000 LOC]
│   ├── src/
│   │   ├── App.tsx             [ADAPTAR — 373 LOC, entry point; quitar postMessage a vscode]
│   │   ├── main.tsx            [REUSAR — 21 LOC]
│   │   ├── browserMock.ts      [REUSAR — 267 LOC, YA existe mock para correr sin VS Code]
│   │   ├── vscodeApi.ts        [REEMPLAZAR — 7 LOC, cambiar por client WS]
│   │   ├── runtime.ts          [REUSAR — 16 LOC]
│   │   ├── constants.ts        [REUSAR]
│   │   ├── changelogData.ts    [OPCIONAL]
│   │   ├── notificationSound.ts [REUSAR]
│   │   ├── office/             [REUSAR — corazón del renderer]
│   │   │   ├── engine/         gameLoop.ts, renderer.ts, characters.ts, officeState.ts, matrixEffect.ts
│   │   │   ├── components/     OfficeCanvas.tsx, ToolOverlay.tsx
│   │   │   ├── sprites/        spriteCache, spriteData, bubble jsons
│   │   │   ├── editor/         editor de layout
│   │   │   ├── layout/
│   │   │   ├── colorize.ts, toolUtils.ts, floorTiles.ts, wallTiles.ts
│   │   │   └── types.ts
│   │   ├── components/         [REUSAR — UI shadcn-like propia]
│   │   │   ├── BottomToolbar.tsx, SettingsModal.tsx, ChangelogModal.tsx
│   │   │   ├── EditActionBar.tsx, ZoomControls.tsx, Tooltip.tsx
│   │   │   ├── DebugView.tsx, VersionIndicator.tsx, MigrationNotice.tsx
│   │   │   └── ui/
│   │   └── hooks/              [REUSAR]
│   └── public/
│       └── assets/             [REUSAR TAL CUAL — 241 KB total, MIT]
│           ├── characters/     sprites Metro City
│           ├── furniture/      muebles con manifests
│           ├── floors/, walls/
│           └── default-layout-1.json
│
└── docs/, e2e/, eslint-rules/  [DESCARTAR / OPCIONAL]
```

## Puntos de acoplamiento a `vscode` (10 archivos)

| Archivo | Uso del API `vscode` | Reemplazo propuesto |
|---|---|---|
| `src/extension.ts:1` | `vscode.ExtensionContext`, `registerWebviewViewProvider`, `commands.registerCommand` | **Descartar todo el archivo**. Entry point pasa a ser `backend/src/server.ts` (Fastify). |
| `src/PixelAgentsViewProvider.ts` | `vscode.WebviewView`, `postMessage`, `onDidReceiveMessage`, `Uri` | **Reescribir como Fastify + WebSocket**. Los patterns de postMessage ↔ webview se traducen a mensajes WS. |
| `src/fileWatcher.ts` | `vscode.workspace.fs`, `createFileSystemWatcher` | **Descartar**. Nuestro enfoque es spawn con stream-json, NO tail de transcripts. |
| `src/transcriptParser.ts` | Lee formato JSONL de `~/.claude/projects/` | **Robar patterns**, reescribir para **stream-json** (diferente formato, validado en SPIKE-02). |
| `src/agentManager.ts` | VS Code state sync | **Reescribir** como `backend/src/sessions/SessionManager.ts`. |
| `src/assetLoader.ts` | `vscode.Uri.joinPath`, `fs` bridges | **Simplificar**: Next.js sirve assets desde `public/`. 90% se descarta. |
| `src/layoutPersistence.ts`, `configPersistence.ts` | `vscode.workspace.fs` | **Reescribir** → `node:fs/promises` contra `~/.agent-workbench/` (ADR-006). |
| `src/types.ts` | Tipos mixtos | **Portable**: extraer tipos de dominio, tirar los de VS Code. |
| `server/src/hookEventHandler.ts` | `import vscode` (único en server/) | **Desacoplar**: el resto de `server/` ya es Node puro. |
| `webview-ui/src/vscodeApi.ts` | `acquireVsCodeApi()` (webview global) | **Reemplazar** por cliente WS del browser (`useWebSocket.ts`). |

## Parser de actividad: diferencia crítica

- **pixel-agents**: tailea `~/.claude/projects/**/history.jsonl` con chokidar. Detecta cambios de línea, parsea tipos de evento (`tool_use`, `tool_result`, `user`, `assistant`), actualiza state machine de NPC.
- **Agent Workbench**: spawnea `claude --print --output-format stream-json --input-format stream-json --verbose` (confirmado en SPIKE-02). Lee eventos en **real-time** del stdout del proceso hijo, no del filesystem. Formato parecido pero no idéntico.
- **Implicancia**: los 633 LOC de `transcriptParser.ts` sirven como **referencia de los tipos de evento a esperar y del state machine `idle/typing/tool_use/waiting`**, pero el motor de ingesta se reescribe. Estimamos **~250-350 LOC** para un parser de stream-json propio en el backend.

## Estructura de monorepo propuesta tras el desacople

```
agent-workbench/
├── package.json                      # monorepo root (pnpm workspaces)
├── pnpm-workspace.yaml
├── NOTICE.md                         # atribución MIT a pixel-agents
├── LICENSES/
│   └── pixel-agents-MIT.txt
│
├── frontend/                         # Next.js 15 App Router
│   ├── app/                          # Next entry
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # pantalla full-screen del juego
│   │   └── globals.css
│   ├── components/                   # UI nueva (AgentDock, ChatWindow, TerminalTabs)
│   ├── office/                       # ← COPIADO tal cual de pixel-agents/webview-ui/src/office
│   ├── hooks/
│   │   ├── useWebSocket.ts           # nuevo (reemplaza vscodeApi.ts)
│   │   ├── useAgentSessions.ts       # Zustand
│   │   └── useMapState.ts
│   ├── lib/
│   │   ├── protocol.ts               # WS protocol, compartido
│   │   └── agents.ts
│   └── public/
│       └── assets/                   # ← COPIADO tal cual de pixel-agents/webview-ui/public/assets
│
├── backend/                          # Fastify + @fastify/websocket
│   ├── src/
│   │   ├── server.ts                 # entry
│   │   ├── sessions/
│   │   │   ├── SessionManager.ts
│   │   │   ├── AgentSession.ts       # wrapper proceso Claude Code (execa)
│   │   │   └── streamParser.ts       # parser stream-json propio
│   │   ├── terminal/
│   │   │   └── PtySession.ts         # node-pty para tab Bash (ADR-004)
│   │   ├── config/
│   │   │   ├── loadAgents.ts
│   │   │   └── pathGuard.ts          # denylist/warnlist (ADR-005)
│   │   └── types.ts
│   └── tests/
│
└── shared/
    └── protocol.ts                   # tipos WS compartidos front/back
```

## Estimación de LOC

| Categoría | LOC aprox | Origen |
|---|---:|---|
| **Reusar tal cual** | ~2700 | `webview-ui/src/office/*` (~1800), `components/*` (~500), `public/assets/*` (241KB), `browserMock.ts`, hooks |
| **Adaptar con cambios menores** | ~700 | `App.tsx` (373), `vscodeApi.ts` → `useWebSocket.ts`, `notificationSound.ts`, partes de `server/` |
| **Escribir desde cero (backend)** | ~1200 | `SessionManager`, `AgentSession`, `streamParser`, `PtySession`, `pathGuard`, `loadAgents`, WS server |
| **Escribir desde cero (frontend glue)** | ~600 | Next.js `layout`/`page`, `AgentDock`, `ChatWindow`, `TerminalTabs`, Zustand stores |
| **Descartar** | ~4500 | todo `src/` (extension host) |
| **TOTAL app nueva** | ~5200 | vs ~8-10k si se construyera desde cero |

**Conclusión cuantitativa**: se ahorra ~40-50% de LOC frente a build-from-scratch.

## Plan de ataque para Fase 1 (orden sugerido)

1. **Bootstrap monorepo** — `frontend/` (Next.js 15) + `backend/` (Fastify) + `pnpm-workspace`.
2. **Copia MIT de assets** → `frontend/public/assets/` + `NOTICE.md` con atribución (ADR-003).
3. **Copia del renderer** → `frontend/office/` tal cual, ajustar imports.
4. **Backend mínimo** → `/health`, WS echo, spawn de Claude Code (ya validado en SPIKE-02), parser stream-json.
5. **Frontend glue** → `useWebSocket`, un solo `ChatWindow` hardcoded, sin mapa todavía.
6. **Integrar renderer** → montar `OfficeCanvas` full-screen, sync con estado Zustand.
7. **US-01 + US-02** funcionando end-to-end (abrir chat + conversar).
8. **Aprobaciones de tools** — reconsiderar según SPIKE-02 (pre-autorización por sesión, NO prompt por invocación).

## Riesgos técnicos detectados

| ID | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R4a | `App.tsx` tiene lógica de postMessage profundamente integrada → el "adaptar" puede ser rewrite parcial. | Media/Media | Dejar una capa `transport.ts` que encapsule WS y simule la interfaz `vscode.postMessage` hacia el resto del código. |
| R4b | `fileWatcher.ts` contiene 1369 LOC de state machine no trivial. Descartarlo nos hace reescribir el parser de cero. | Alta/Media | Usar `transcriptParser.ts` como ejemplar de qué eventos esperar, tipos a modelar. Escribir parser **de stream-json** (SPIKE-02). |
| R4c | El `server/` de pixel-agents es un servidor de hooks MCP independiente del backend que necesitamos. Puede confundir. | Baja/Media | No copiar `server/` salvo piezas concretas. Documentar en README. |
| R4d | Assets dependen del manifest schema de pixel-agents (furniture `manifest.json`). Cualquier cambio que queramos hacerles rompe compat. | Baja/Alta | No tocar schema en MVP. Si hay que extenderlo, hacerlo backward-compat. |
| R4e | `webview-ui/vite.config.ts` está pensado para generar un bundle embebido en extension. Moverlo a Next.js rompe eso. | Media/Media | Next.js 15 tiene `output: export` y buen soporte para Canvas. Incorporar archivos como componentes client-side (`"use client"`). |

## NOTICE.md sugerido (para el root del repo nuevo)

```
NOTICE

This project adopts code, assets and patterns from pixel-agents
(https://github.com/pablodelucca/pixel-agents) by Pablo De Lucca,
released under the MIT License. Full license text available at
LICENSES/pixel-agents-MIT.txt.

Reused components:
- Office renderer (Canvas 2D engine, sprites, game loop) — frontend/office/
- Visual assets (characters, furniture, tiles, manifests) — frontend/public/assets/
- UI components (toolbar, modals, zoom controls) — frontend/components/ui/

Character sprites are based on the "Metro City free topdown character pack"
by JIK-A-4; see upstream attribution in webview-ui/README.md.
```

## Conclusión

- Adoptar pixel-agents **sigue siendo la decisión correcta**: el renderer + assets son oro y ya vienen con una capa `browserMock` que facilita el desacople del API de VS Code.
- El corazón de la lógica de ingesta (`fileWatcher` + `transcriptParser`) **no se reusa**; se escribe un parser de stream-json propio (~300 LOC).
- **No hay blocker técnico para arrancar Fase 1** tras aplicar los cambios de diseño del SPIKE-02 (aprobaciones por sesión, no por tool use).

## Preguntas abiertas

1. ¿Copiamos también `server/` de pixel-agents como base del backend, o arrancamos Fastify limpio? Recomendado: Fastify limpio; solo robar tipos/patterns puntuales.
2. ¿El editor de layout de la oficina (`webview-ui/src/office/editor/`) entra en MVP o se deja fuera? Recomendado: **fuera de MVP**, agregar en Fase 4.
3. ¿Actualizamos ADR-001 para reflejar el hallazgo de `browserMock.ts` (desacople más barato de lo que se asumió)? Recomendado: sí, nota al pie.

## Acciones derivadas

- Actualizar ADR-001 con la confirmación de `browserMock.ts` como facilitador.
- Revisar estimación de esfuerzo de Fase 1 en `docs/technical/risks-and-spikes.md` a la baja (menos LOC a escribir).
- Confirmar decisión sobre `server/` de pixel-agents y editor de layout antes de Fase 1.
