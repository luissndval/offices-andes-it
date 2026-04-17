import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { AllowedToolLevel } from '../protocol.js';

export type AgentDefinition = {
  id: string;
  displayName: string;
  description: string;
  color: string;
  promptPath: string;
  defaultToolLevel: AllowedToolLevel;
};

const REPO_ROOT = resolve(process.cwd(), '..');
const AGENTS_DIR = join(REPO_ROOT, '.claude', 'agents');

const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    id: 'product-owner',
    displayName: 'Product Owner',
    description: 'Prioriza backlog, define épicas y features',
    color: '#F7B955',
    promptPath: join(AGENTS_DIR, 'product-owner.md'),
    defaultToolLevel: 'read_only',
  },
  {
    id: 'analista-funcional',
    displayName: 'Analista Funcional',
    description: 'Escribe User Stories con Gherkin',
    color: '#4FC3F7',
    promptPath: join(AGENTS_DIR, 'analista-funcional.md'),
    defaultToolLevel: 'read_only',
  },
  {
    id: 'tech-lead',
    displayName: 'Tech Lead',
    description: 'Arquitectura, ADRs, trade-offs',
    color: '#7F77DD',
    promptPath: join(AGENTS_DIR, 'tech-lead.md'),
    defaultToolLevel: 'edit',
  },
  {
    id: 'ux-ui',
    displayName: 'UX/UI',
    description: 'Flujos, accesibilidad, specs de pantalla',
    color: '#FF85A1',
    promptPath: join(AGENTS_DIR, 'ux-ui.md'),
    defaultToolLevel: 'read_only',
  },
  {
    id: 'dev-backend',
    displayName: 'Dev Backend',
    description: 'APIs, lógica de negocio, persistencia',
    color: '#66BB6A',
    promptPath: join(AGENTS_DIR, 'dev-backend.md'),
    defaultToolLevel: 'full',
  },
  {
    id: 'dev-frontend-mobile',
    displayName: 'Dev Frontend Mobile',
    description: 'Pantallas iOS/Android, integración APIs',
    color: '#AB47BC',
    promptPath: join(AGENTS_DIR, 'dev-frontend-mobile.md'),
    defaultToolLevel: 'full',
  },
  {
    id: 'qa-tester',
    displayName: 'QA / Tester',
    description: 'Casos de prueba, bugs, validación',
    color: '#EF5350',
    promptPath: join(AGENTS_DIR, 'qa-tester.md'),
    defaultToolLevel: 'read_only',
  },
  {
    id: 'devops',
    displayName: 'DevOps',
    description: 'CI/CD, infraestructura, releases',
    color: '#8D6E63',
    promptPath: join(AGENTS_DIR, 'devops.md'),
    defaultToolLevel: 'full',
  },
];

export function listAgents(): AgentDefinition[] {
  return BUILTIN_AGENTS;
}

export function getAgent(id: string): AgentDefinition | undefined {
  return BUILTIN_AGENTS.find((a) => a.id === id);
}

export async function readAgentPrompt(agent: AgentDefinition): Promise<string> {
  return await readFile(agent.promptPath, 'utf8');
}
