# Agent Workbench

App web local que visualiza agentes de Claude Code como NPCs en una oficina 2D, con chat multi-ventana, terminal embebida y spawn directo de `claude --print --output-format stream-json` por sesión.

Basado en [pixel-agents](https://github.com/pablodelucca/pixel-agents) (MIT) — ver [`NOTICE.md`](NOTICE.md).

## Estado

**Fase 0** — bootstrap del monorepo y smoke test WebSocket frontend ↔ backend. No hay spawn de Claude Code todavía.

Documentación viva:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — arquitectura original (algunas decisiones fueron superadas por ADRs posteriores).
- [`docs/functional/`](docs/functional) — épica + 9 User Stories con Gherkin.
- [`docs/technical/`](docs/technical) — diseño técnico, ADRs, protocolo WS, riesgos y spikes.
- [`docs/technical/spikes/`](docs/technical/spikes) — resultados de SPIKE-02 (flags del CLI) y SPIKE-04 (desacople de pixel-agents).

## Requisitos

- Node.js 20+ (recomendado 22.x)
- pnpm 10+
- Claude Code CLI 2.x instalado y loggeado con suscripción Max (`claude --version`)
- **No** setear `ANTHROPIC_API_KEY` (si está seteada, el backend aborta al iniciar — facturaría contra API en vez de usar Max)

## Setup

```bash
pnpm install
cp .env.example .env
```

## Desarrollo

```bash
pnpm dev
```

- Frontend en http://localhost:3000
- Backend en http://127.0.0.1:3001 (WS en `/ws`, health en `/health`)

Abrí el frontend y deberías ver "Estado: connected" más el mensaje `{"type":"hello"...}` del backend y el `pong` en respuesta al `ping` inicial.

## Estructura

```
agent-workbench/
├── frontend/         Next.js 15 + React 19
│   └── app/          App Router (full-screen tipo juego)
├── backend/          Fastify 5 + @fastify/websocket + execa
│   └── src/server.ts
├── docs/
│   ├── functional/   User stories (9) + épica
│   └── technical/    ADRs (7), protocolo WS, lifecycle, spikes
├── NOTICE.md         Atribución MIT a pixel-agents
└── LICENSES/         Textos completos de licencias reusadas
```

## Scripts raíz

| Script | Qué hace |
|---|---|
| `pnpm dev` | Levanta frontend y backend en paralelo |
| `pnpm build` | Build de producción de ambos |
| `pnpm clean` | Limpia `.next`, `dist`, `node_modules` |
