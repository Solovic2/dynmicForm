import type { FastifyInstance, FastifyReply } from 'fastify';
import type { z } from 'zod';
import { HttpError } from './errors.js';

/**
 * Validate a request body with a zod schema. On failure, sends a 400 reply and
 * returns undefined (caller should `return`). On success returns the parsed value.
 */
export function parseBody<S extends z.ZodTypeAny>(
  app: FastifyInstance,
  schema: S,
  body: unknown,
  reply: FastifyReply,
): z.infer<S> | undefined {
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

/**
 * Translate a thrown service error into an HTTP reply. Re-throws anything that
 * isn't an `HttpError` so it surfaces as a 500.
 */
export function sendServiceError(app: FastifyInstance, reply: FastifyReply, err: unknown): void {
  if (err instanceof HttpError) {
    reply.send(app.httpErrors.createError(err.statusCode, err.message));
    return;
  }
  throw err;
}
