import type { FastifyInstance } from 'fastify';
import { accountRoutes } from './auth.js';
import { formRoutes } from './forms.js';

/**
 * Guarded scope for authenticated routes.
 *
 * This is an encapsulated Fastify context: the `onRequest` hook runs the
 * `authenticate` guard for every route registered here, so protection is
 * automatic and opt-out is impossible — you cannot forget a per-route
 * `preHandler`. Register all token-protected route groups (account, forms,
 * users, ...) inside this function.
 *
 * Public routes (health, login/register/refresh/logout) are registered
 * OUTSIDE this scope in `app.ts`.
 */
export async function protectedRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  await app.register(accountRoutes);
  await app.register(formRoutes);
}
