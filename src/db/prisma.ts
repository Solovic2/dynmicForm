import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient.
 *
 * In dev, `tsx watch` reloads the module graph on change; caching the client on
 * `globalThis` prevents exhausting the DB connection pool with a new client per
 * reload. In production a single instance is created normally.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
