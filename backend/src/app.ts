import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { healthRoutes } from './routes/health.js';

/**
 * Builds and configures the Fastify application.
 * Kept separate from server bootstrap so it can be reused in tests.
 */
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
    ...opts,
  });

  // Plugins
  await app.register(sensible);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  });

  // Routes
  await app.register(healthRoutes);

  return app;
}
