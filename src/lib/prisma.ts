import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

/**
 * Singleton Prisma client.
 *
 * Cached on `globalThis` in non-production so hot-reload (tsx watch) does not
 * open a new connection pool on every reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!isProd) {
  globalForPrisma.prisma = prisma;
}
