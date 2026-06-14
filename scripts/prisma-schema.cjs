require('dotenv/config');

/**
 * Pick Prisma schema from DATABASE_URL (mirrors lib/database.ts).
 */
function resolvePrismaSchema(env = process.env) {
  const url = env.DATABASE_URL || '';
  if (url.startsWith('file:')) {
    return 'prisma/schema.sqlite.prisma';
  }
  return 'prisma/schema.prisma';
}

function resolveDatabaseKind(env = process.env) {
  const url = env.DATABASE_URL || '';
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql';
  return 'unknown';
}

module.exports = { resolvePrismaSchema, resolveDatabaseKind };
