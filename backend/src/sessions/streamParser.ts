import type { ServerMessage } from '../protocol.js';

type StreamEvent =
  | {
      type: 'system';
      subtype: string;
      session_id?: string;
      cwd?: string;
      tools?: string[];
      model?: string;
      permissionMode?: string;
    }
  | {
      type: 'assistant';
      message: {
        id?: string;
        content: Array<
          | { type: 'text'; text: string }
          | { type: 'thinking'; thinking: string }
          | { type: 'tool_use'; id: string; name: string; input: unknown }
        >;
        stop_reason?: string | null;
      };
      session_id?: string;
    }
  | {
      type: 'user';
      message: {
        content: Array<{
          tool_use_id: string;
          type: 'tool_result';
          content: string | Array<{ type: string; text?: string }>;
          is_error?: boolean;
        }>;
      };
    }
  | {
      type: 'result';
      subtype: string;
      is_error: boolean;
      result?: string;
      stop_reason?: string;
      total_cost_usd?: number;
      session_id?: string;
    }
  | { type: string; [k: string]: unknown };

export type ParsedEvent =
  | { kind: 'init'; cliSessionId: string; tools: string[]; model: string }
  | { kind: 'assistant_text'; text: string }
  | { kind: 'assistant_thinking'; thinking: string }
  | { kind: 'tool_use'; toolUseId: string; tool: string; input: unknown }
  | { kind: 'tool_result'; toolUseId: string; output: string; isError: boolean }
  | { kind: 'result'; text: string; costUsd?: number; isError: boolean }
  | { kind: 'ignored'; rawType: string };

export function parseStreamLine(line: string): ParsedEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let ev: StreamEvent;
  try {
    ev = JSON.parse(trimmed) as StreamEvent;
  } catch {
    return null;
  }

  if (ev.type === 'system' && (ev as { subtype?: string }).subtype === 'init') {
    const s = ev as Extract<StreamEvent, { type: 'system' }>;
    return {
      kind: 'init',
      cliSessionId: s.session_id ?? '',
      tools: s.tools ?? [],
      model: s.model ?? 'unknown',
    };
  }

  if (ev.type === 'assistant') {
    const a = ev as Extract<StreamEvent, { type: 'assistant' }>;
    for (const block of a.message.content) {
      if (block.type === 'text') return { kind: 'assistant_text', text: block.text };
      if (block.type === 'thinking')
        return { kind: 'assistant_thinking', thinking: block.thinking };
      if (block.type === 'tool_use')
        return {
          kind: 'tool_use',
          toolUseId: block.id,
          tool: block.name,
          input: block.input,
        };
    }
    return { kind: 'ignored', rawType: 'assistant_empty' };
  }

  if (ev.type === 'user') {
    const u = ev as Extract<StreamEvent, { type: 'user' }>;
    const first = u.message.content[0];
    if (first && first.type === 'tool_result') {
      const output =
        typeof first.content === 'string'
          ? first.content
          : first.content.map((c) => ('text' in c && c.text ? c.text : '')).join('');
      return {
        kind: 'tool_result',
        toolUseId: first.tool_use_id,
        output,
        isError: Boolean(first.is_error),
      };
    }
    return { kind: 'ignored', rawType: 'user_non_tool' };
  }

  if (ev.type === 'result') {
    const r = ev as Extract<StreamEvent, { type: 'result' }>;
    return {
      kind: 'result',
      text: r.result ?? '',
      costUsd: r.total_cost_usd,
      isError: Boolean(r.is_error),
    };
  }

  return { kind: 'ignored', rawType: ev.type };
}

export function parsedToServerMessages(
  sessionId: string,
  parsed: ParsedEvent,
): ServerMessage[] {
  switch (parsed.kind) {
    case 'assistant_text':
      return [{ type: 'message_chunk', sessionId, delta: parsed.text }];
    case 'tool_use':
      return [
        { type: 'agent_state', sessionId, state: 'tool_use' },
        {
          type: 'tool_use',
          sessionId,
          toolUseId: parsed.toolUseId,
          tool: parsed.tool,
          input: parsed.input,
        },
      ];
    case 'tool_result':
      return [
        {
          type: 'tool_result',
          sessionId,
          toolUseId: parsed.toolUseId,
          output: parsed.output,
          isError: parsed.isError,
        },
        { type: 'agent_state', sessionId, state: 'typing_response' },
      ];
    case 'result':
      return [
        {
          type: 'message_complete',
          sessionId,
          text: parsed.text,
          costUsd: parsed.costUsd,
        },
        { type: 'agent_state', sessionId, state: 'idle' },
      ];
    case 'assistant_thinking':
      return [{ type: 'agent_state', sessionId, state: 'thinking' }];
    default:
      return [];
  }
}
