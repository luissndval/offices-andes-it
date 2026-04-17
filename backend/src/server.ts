import Fastify from 'fastify';
import websocket from '@fastify/websocket';

import { listAgents } from './config/loadAgents.js';
import type { ClientMessage, ServerMessage } from './protocol.js';
import { SessionManager } from './sessions/SessionManager.js';

const HOST = process.env.BACKEND_HOST ?? '127.0.0.1';
const PORT = Number(process.env.BACKEND_PORT ?? 3001);
const VERSION = '0.1.0';

if (process.env.ANTHROPIC_API_KEY) {
  console.error(
    '[fatal] ANTHROPIC_API_KEY is set. Unset it before starting the backend — otherwise Claude Code will bill the API instead of using the Max subscription.',
  );
  process.exit(1);
}

const app = Fastify({ logger: true });
await app.register(websocket);

const manager = new SessionManager();

app.get('/health', async () => ({ status: 'ok', service: 'agent-workbench-backend', version: VERSION }));

app.get('/agents', async () =>
  listAgents().map((a) => ({
    id: a.id,
    displayName: a.displayName,
    description: a.description,
    color: a.color,
    defaultToolLevel: a.defaultToolLevel,
  })),
);

app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    const send = (msg: ServerMessage) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    };

    send({ type: 'hello', service: 'agent-workbench-backend', version: VERSION });

    socket.on('message', async (raw: Buffer) => {
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        send({ type: 'error', code: 'invalid_json', message: 'Invalid JSON payload' });
        return;
      }

      switch (parsed.type) {
        case 'open_session': {
          app.log.info({ agentId: parsed.agentId, projectPath: parsed.projectPath }, 'open_session received');
          const result = manager.openSession({
            agentId: parsed.agentId,
            projectPath: parsed.projectPath,
            toolLevel: parsed.toolLevel,
            emit: send,
          });
          if (!result.ok) {
            app.log.warn({ error: result.error }, 'open_session failed');
            send(result.error);
          } else {
            app.log.info({ sessionId: result.sessionId }, 'session spawned');
          }
          return;
        }
        case 'send_message': {
          const err = manager.sendMessage(parsed.sessionId, parsed.content);
          if (err) send(err);
          return;
        }
        case 'close_session': {
          await manager.closeSession(parsed.sessionId, 'closed_by_user');
          return;
        }
        default: {
          send({
            type: 'error',
            code: 'unsupported_message',
            message: `Unsupported message type: ${(parsed as { type: string }).type}`,
          });
        }
      }
    });

    socket.on('close', () => {
      // Client disconnected; sessions keep running so the user can reconnect.
      // Cleanup on server shutdown handled by process signal handlers.
    });
  });
});

const shutdown = async (signal: string) => {
  app.log.info(`Received ${signal}, shutting down sessions and server`);
  await manager.closeAll();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`Backend listening at http://${HOST}:${PORT} (WS at /ws)`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
