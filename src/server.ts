import { env } from './config/env.js';
import { buildApp } from './app.js';
import { ensureBucket } from './lib/storage.js';

const PORT = env.PORT;
const HOST = env.HOST; // 0.0.0.0 is required inside Docker

async function start(): Promise<void> {
  const isDev = env.NODE_ENV !== 'production';

  const app = await buildApp({
    logger: isDev
      ? { transport: { target: 'pino-pretty' } }
      : true,
  });

  // Ensure the object-storage bucket exists before accepting traffic.
  try {
    await ensureBucket();
  } catch (err) {
    app.log.error({ err }, 'Failed to ensure storage bucket exists');
    process.exit(1);
  }

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  }
}

void start();
