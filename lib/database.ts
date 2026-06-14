/** Database helpers shared by Prisma client and API error handling */

export function resolvePrismaSchema(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.DATABASE_URL || '';
  if (url.startsWith('file:')) {
    return 'prisma/schema.sqlite.prisma';
  }
  return 'prisma/schema.prisma';
}

export function resolveDatabaseKind(env: NodeJS.ProcessEnv = process.env): 'sqlite' | 'postgresql' | 'unknown' {
  const url = env.DATABASE_URL || '';
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  return 'unknown';
}
