import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccessToken } from '../lib/tokens.js';

/** The authenticated principal attached to a request after `authenticate`. */
export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** preHandler that requires a valid access token; else replies 401. */
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Registers the `authenticate` decorator. Use it on protected routes:
 *   app.get('/me', { preHandler: [app.authenticate] }, handler)
 */
export const authPlugin = fp(async (app) => {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const header = request.headers.authorization;
      if (!header || !header.startsWith('Bearer ')) {
        reply.send(app.httpErrors.unauthorized('Missing or malformed Authorization header'));
        return;
      }

      const token = header.slice('Bearer '.length).trim();
      try {
        const payload = verifyAccessToken(token);
        request.user = { id: payload.sub, email: payload.email };
      } catch {
        reply.send(app.httpErrors.unauthorized('Invalid or expired access token'));
      }
    },
  );
});
