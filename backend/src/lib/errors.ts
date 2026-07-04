/**
 * Error carrying an HTTP status for the route layer to translate into a reply
 * (via @fastify/sensible's `httpErrors`). Services throw this; routes catch it.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
