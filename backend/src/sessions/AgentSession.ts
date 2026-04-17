import { execa, type ResultPromise } from 'execa';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

import type { AgentDefinition } from '../config/loadAgents.js';
import type { AllowedToolLevel, ServerMessage } from '../protocol.js';
import { TOOL_PROFILES } from '../protocol.js';
import { parsedToServerMessages, parseStreamLine } from './streamParser.js';

export type AgentSessionOptions = {
  agent: AgentDefinition;
  projectPath: string;
  toolLevel: AllowedToolLevel;
  onMessage: (msg: ServerMessage) => void;
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
};

const KILL_GRACE_MS = 2000;

export class AgentSession {
  readonly sessionId = randomUUID();
  readonly agent: AgentDefinition;
  readonly projectPath: string;
  readonly toolLevel: AllowedToolLevel;

  private proc: ResultPromise | null = null;
  private onMessage: (msg: ServerMessage) => void;
  private onExit: (code: number | null, signal: NodeJS.Signals | null) => void;
  private closed = false;

  constructor(opts: AgentSessionOptions) {
    this.agent = opts.agent;
    this.projectPath = opts.projectPath;
    this.toolLevel = opts.toolLevel;
    this.onMessage = opts.onMessage;
    this.onExit = opts.onExit;
  }

  start(): void {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    const allowedTools = TOOL_PROFILES[this.toolLevel].join(',');

    const args = [
      '--print',
      '--verbose',
      '--output-format',
      'stream-json',
      '--input-format',
      'stream-json',
      '--append-system-prompt-file',
      this.agent.promptPath,
      '--permission-mode',
      'dontAsk',
      '--allowed-tools',
      allowedTools,
      '--no-session-persistence',
    ];

    this.proc = execa('claude', args, {
      cwd: this.projectPath,
      env,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

    // IMPORTANT: claude CLI does NOT emit the `init` event until it receives
    // the first input on stdin. We emit `session_opened` immediately on spawn
    // so the UI can render the chat; the real init event is handled later
    // as an extra confirmation (but ignored if it already arrived).
    this.onMessage({
      type: 'session_opened',
      sessionId: this.sessionId,
      agentId: this.agent.id,
      cwd: this.projectPath,
    });
    this.onMessage({
      type: 'agent_state',
      sessionId: this.sessionId,
      state: 'idle',
    });

    const stdout = this.proc.stdout;
    if (stdout) {
      const rl = createInterface({ input: stdout });
      rl.on('line', (line) => this.handleStdoutLine(line));
    }

    this.proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      this.onMessage({
        type: 'error',
        sessionId: this.sessionId,
        code: 'claude_stderr',
        message: text.slice(0, 500),
      });
    });

    this.proc
      .then((res) => {
        if (this.closed) return;
        this.closed = true;
        this.onExit(res.exitCode ?? null, res.signal ?? null);
      })
      .catch((err: unknown) => {
        if (this.closed) return;
        this.closed = true;
        this.onMessage({
          type: 'error',
          sessionId: this.sessionId,
          code: 'spawn_failed',
          message: err instanceof Error ? err.message : String(err),
        });
        this.onExit(null, null);
      });
  }

  sendUserMessage(content: string): void {
    if (!this.proc || !this.proc.stdin || this.closed) {
      this.onMessage({
        type: 'error',
        sessionId: this.sessionId,
        code: 'session_closed',
        message: 'Cannot send message: session is closed',
      });
      return;
    }

    const line =
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content },
      }) + '\n';

    this.onMessage({ type: 'agent_state', sessionId: this.sessionId, state: 'thinking' });
    this.proc.stdin.write(line);
  }

  async close(reason?: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    if (this.proc) {
      this.proc.stdin?.end();
      this.proc.kill('SIGTERM');
      const timeout = setTimeout(() => {
        this.proc?.kill('SIGKILL');
      }, KILL_GRACE_MS);
      try {
        await this.proc;
      } catch {
        // ignore — we forced termination
      } finally {
        clearTimeout(timeout);
      }
    }

    this.onMessage({
      type: 'session_closed',
      sessionId: this.sessionId,
      reason: reason ?? 'closed_by_user',
    });
  }

  private handleStdoutLine(line: string): void {
    const parsed = parseStreamLine(line);
    if (!parsed) return;

    // We already emitted `session_opened` synchronously on spawn; the `init`
    // event from the CLI confirms the spawn internally but is not propagated.
    if (parsed.kind === 'init') return;

    const msgs = parsedToServerMessages(this.sessionId, parsed);
    for (const m of msgs) this.onMessage(m);
  }
}
