const { execSync } = require('child_process');
const { resolvePrismaSchema } = require('./prisma-schema.cjs');

const schema = resolvePrismaSchema();
console.log(`[prisma] seed (schema: ${schema})`);
execSync('npx tsx prisma/seed.ts', { stdio: 'inherit' });
