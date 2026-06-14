import { PrismaClient } from '@prisma/client';
import { resolveDatabaseKind } from './database';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

if (process.env.NODE_ENV === 'development') {
  const kind = resolveDatabaseKind();
  const url = process.env.DATABASE_URL || '(not set)';
  console.log(`[prisma] Database: ${kind} (${url.replace(/:[^:@/]+@/, ':***@')})`);
}

export default prisma;
