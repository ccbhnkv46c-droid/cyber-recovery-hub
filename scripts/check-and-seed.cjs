require('dotenv/config');
const { execSync } = require('child_process');
const { resolvePrismaSchema } = require('./prisma-schema.cjs');

async function main() {
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl) {
    console.log('[seed] DATABASE_URL unset — skipping auto-seed check');
    return;
  }

  const scheme = dbUrl.split('://')[0];
  console.log(`[seed] Checking database (${scheme}://)...`);

  const schema = resolvePrismaSchema();
  execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit' });

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`[seed] Database already seeded (${userCount} users) — skipping`);
      return;
    }

    console.log('[seed] Empty database — running npm run db:seed');
    await prisma.$disconnect();
    execSync('node scripts/prisma-seed.cjs', { stdio: 'inherit', env: process.env });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[seed] Auto-seed failed:', err);
  process.exit(1);
});
