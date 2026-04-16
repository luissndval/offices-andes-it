# Kick-off — Agent Workbench

Claude, vas a construir un proyecto llamado **Agent Workbench**. Toda la arquitectura está definida en `ARCHITECTURE.md`. Leelo completo antes de escribir una sola línea de código.

## Reglas no negociables

1. **Fase por fase.** Empezás por la Fase 0 del plan de implementación (sección 13). No saltes a la Fase 1 sin completar la 0. Al terminar cada fase pedís al usuario que la pruebe.

2. **No improvises scope.** Si el documento no lo pide, no lo hagas. Si descubrís que falta algo, proponelo al usuario antes de implementarlo.

3. **Protocolo WebSocket exacto.** Los tipos de la sección 5 van tal cual en `shared/protocol.ts`. No agregues campos "por si acaso".

4. **No toques el proyecto target.** El proyecto `Apps-PSPMobile-FE` se usa como source de agentes (`.claude/agents/*.md`) y como filesystem donde Claude Code ejecuta tools, pero **este repo nuevo vive aparte**. No agregues archivos al proyecto mobile.

5. **Una sola feature por commit.** Conventional commits en inglés.

## Estructura esperada del repo

Creá el proyecto en `C:\claude-office\agent-workbench` (carpeta hermana de claude-office para mantener las cosas ordenadas). Si el path no existe, pedí confirmación antes de crear fuera.

```
agent-workbench/
├── ARCHITECTURE.md          ← ya existe, no tocar
├── KICKOFF.md               ← este archivo
├── README.md                ← generar en Fase 0
├── package.json             ← monorepo root
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
├── frontend/
└── backend/
```

## Orden de ejecución (Fase 0)

Estos son los primeros pasos concretos:

1. Verificar dependencias locales:
   ```bash
   node --version    # debe ser 20+
   pnpm --version    # si no existe: npm install -g pnpm
   claude --version  # debe estar instalado y logueado
   ```

2. Crear la estructura base del monorepo:
   ```bash
   cd /c/claude-office
   mkdir agent-workbench
   cd agent-workbench
   pnpm init
   # Configurar como monorepo con workspaces
   ```

3. `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "frontend"
     - "backend"
   ```

4. Scripts en package.json raíz:
   ```json
   {
     "scripts": {
       "dev": "concurrently -n frontend,backend -c cyan,magenta \"pnpm --filter frontend dev\" \"pnpm --filter backend dev\"",
       "build": "pnpm --filter frontend build && pnpm --filter backend build",
       "clean": "rimraf frontend/.next frontend/node_modules backend/dist backend/node_modules node_modules"
     }
   }
   ```

5. Crear `frontend/` con `pnpm create next-app@latest frontend --ts --tailwind --app --no-src-dir --use-pnpm`.

6. Crear `backend/` manualmente:
   - `pnpm init` en la carpeta.
   - Instalar `fastify @fastify/websocket`, deps de dev: `typescript @types/node tsx`.
   - `tsconfig.json` con target ES2022, module ESNext.
   - `src/server.ts` con setup mínimo de Fastify + ping/pong WS en puerto 3001.

7. En `frontend/app/page.tsx`, conectar a `ws://localhost:3001/ws`, enviar `ping`, mostrar `pong` en pantalla.

8. Probar que `pnpm dev` levanta ambos y el ping funciona.

9. `.env.example`, `README.md` con instrucciones de setup y dev.

10. Commit: `chore: bootstrap monorepo with frontend + backend + websocket ping`.

## Checkpoint Fase 0

Cuando termines, escribí al usuario:

```
✅ Fase 0 completada

Podés probarlo así:
1. cd /c/claude-office/agent-workbench
2. pnpm install
3. pnpm dev
4. Abrir http://localhost:3000
5. Debería decir "Connected to backend"

Si todo OK, respondeme "seguí con Fase 1".
```

No arranques la Fase 1 sin ese "seguí".

## Preguntas que podés hacer al usuario durante Fase 0

Si alguna decisión te hace dudar:

- "¿El puerto 3001 está libre o usás algo ahí?"
- "¿Preferís que el backend logs vayan a consola o a archivo?"
- "¿Inicializo con git? ¿Qué remote?"

No hagas asumptions silenciosas en cosas que pueden generar rework.

## Qué hacer si algo rompe

- Si un comando falla, parate y reportá el error completo al usuario. No intentes "arreglarlo desde adentro".
- Si descubrís que `claude` CLI no tiene una flag que el documento menciona, revisá `claude --help` y adaptá. Si hay ambigüedad, preguntá al usuario.
- Si el stream-json format cambió desde que se escribió este doc, documentá la versión real en un ADR dentro del proyecto.

Listo. Arrancá por el Paso 1 de la Fase 0.
