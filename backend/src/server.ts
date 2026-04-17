import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const HOST = process.env.BACKEND_HOST ?? '127.0.0.1';
const PORT = Number(process.env.BACKEND_PORT ?? 3001);

const app = Fastify({ logger: true });

await app.register(websocket);

app.get('/health', async () => ({ status: 'ok', service: 'agent-workbench-backend' }));

app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    socket.send(JSON.stringify({ type: 'hello', service: 'agent-workbench-backend' }));

    socket.on('message', (raw: Buffer) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'invalid_json' }));
        return;
      }

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'type' in parsed &&
        (parsed as { type: unknown }).type === 'ping'
      ) {
        socket.send(JSON.stringify({ type: 'pong', at: Date.now() }));
        return;
      }

      socket.send(JSON.stringify({ type: 'error', message: 'unsupported_message' }));
    });
  });
});

try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`Backend listening at http://${HOST}:${PORT} (WS at /ws)`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
