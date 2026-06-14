import { Prisma } from '@prisma/client';
import { config } from './config';
import { resolveDatabaseKind } from './database';

export function mapDatabaseError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : String(err);

  if (err instanceof Prisma.PrismaClientInitializationError) {
    if (message.includes('file:') && resolveDatabaseKind() === 'sqlite') {
      return {
        status: 503,
        error: 'Database connection failed — run: npm run db:setup:sqlite',
      };
    }
    return {
      status: 503,
      error: 'Database connection failed — check DATABASE_URL and run npm run db:push',
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2021') {
      return { status: 503, error: 'Database tables missing — run npm run db:push' };
    }
    if (err.code === 'P1001') {
      return { status: 503, error: 'Database unreachable — check DATABASE_URL' };
    }
  }

  if (
    message.includes('Error validating datasource') ||
    message.includes('the URL must start with the protocol') ||
    (message.includes('postgresql') && message.includes('file:'))
  ) {
    return {
      status: 503,
      error:
        'Database provider mismatch — SQLite requires prisma/schema.sqlite.prisma. Run: npm run db:setup:sqlite',
    };
  }

  return {
    status: 500,
    error: config.isDev ? message : 'Internal server error',
  };
}
