import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '../schemas/auth.js';
import {
  AuthError,
  getUserById,
  login,
  logout,
  refresh,
  register,
} from '../services/auth.service.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Parse a request body with a zod schema, replying 400 on failure.
   * Returns undefined (and sends the reply) when validation fails.
   */
  function parseBody<T>(
    schema: z.ZodType<T>,
    body: unknown,
    reply: FastifyReply,
  ): T | undefined {
    const result = schema.safeParse(body);
    if (!result.success) {
      reply.send(
        app.httpErrors.badRequest(
          result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        ),
      );
      return undefined;
    }
    return result.data;
  }

  app.post('/auth/register', async (request, reply) => {
    const input = parseBody(registerSchema, request.body, reply);
    if (!input) return;
    try {
      const result = await register(input);
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.send(app.httpErrors.createError(err.statusCode, err.message));
      }
      throw err;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const input = parseBody(loginSchema, request.body, reply);
    if (!input) return;
    try {
      return await login(input);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.send(app.httpErrors.createError(err.statusCode, err.message));
      }
      throw err;
    }
  });

  app.post('/auth/refresh', async (request, reply) => {
    const input = parseBody(refreshSchema, request.body, reply);
    if (!input) return;
    try {
      return await refresh(input.refreshToken);
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.send(app.httpErrors.createError(err.statusCode, err.message));
      }
      throw err;
    }
  });

  app.post('/auth/logout', async (request, reply) => {
    const input = parseBody(logoutSchema, request.body, reply);
    if (!input) return;
    await logout(input.refreshToken);
    return reply.code(204).send();
  });
}

/**
 * Authenticated account routes. These are registered inside the protected scope
 * (see `routes/protected.ts`), which applies the `authenticate` guard, so there
 * is no per-route `preHandler` here — `request.user` is guaranteed to be set.
 */
export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.get('/auth/me', async (request, reply) => {
    const user = await getUserById(request.user!.id);
    if (!user) {
      return reply.send(app.httpErrors.notFound('User not found'));
    }
    return user;
  });
}
