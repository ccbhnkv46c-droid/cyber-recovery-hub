const { execSync } = require('child_process');
const { resolvePrismaSchema } = require('./prisma-schema.cjs');

const schema = resolvePrismaSchema();
const dbUrl = process.env.DATABASE_URL || '';
const scheme = dbUrl.includes('://') ? dbUrl.split('://')[0] : '(unset)';

console.log(`[prisma] seed using schema: ${schema}`);
console.log(`[prisma] DATABASE_URL prefix: ${scheme}://`);

execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit' });
execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
