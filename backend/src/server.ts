import { buildApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0'; // 0.0.0.0 is required inside Docker

async function start(): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production';

  const app = await buildApp({
    logger: isDev
      ? { transport: { target: 'pino-pretty' } }
      : true,
  });

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
