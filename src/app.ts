import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { protectedRoutes } from './routes/protected.js';
import { publicRoutes } from './routes/public.js';
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
    origin: env.CORS_ORIGIN?.split(',') ?? true,
  });
  await app.register(authPlugin);
  await app.register(multipart, {
    limits: { fileSize: env.MAX_UPLOAD_BYTES },
  });

  // Public routes
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(publicRoutes);

  // Protected routes — everything registered inside requires a valid access token
  await app.register(protectedRoutes);

  return app;
}
