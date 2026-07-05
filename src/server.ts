import { createRequire } from 'node:module';
import { env } from './config/env.js';
import { buildApp } from './app.js';
import { ensureBucket } from './lib/storage.js';

const PORT = env.PORT;
const HOST = env.HOST; // 0.0.0.0 is required inside Docker

/** pino-pretty is a devDependency and absent from the production image. */
function prettyLoggerAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  const isDev = env.NODE_ENV !== 'production';

  // Use the pretty logger only in dev AND only when it's actually installed —
  // so a misconfigured NODE_ENV can never crash the server on a missing transport.
  const app = await buildApp({
    logger:
      isDev && prettyLoggerAvailable()
        ? { transport: { target: 'pino-pretty' } }
        : true,
  });

  // Ensure the object-storage bucket exists. Non-fatal: if storage is
  // misconfigured or unreachable, the API still starts so non-file forms work —
  // only file uploads/downloads will fail (and surface their own errors).
  try {
    await ensureBucket();
  } catch (err) {
    app.log.warn({ err }, 'Storage bucket check failed — file uploads will not work until fixed');
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
