const { execSync } = require('child_process');
const { resolvePrismaSchema } = require('./prisma-schema.cjs');

const schema = resolvePrismaSchema();
console.log(`[prisma] db push → ${schema}`);
execSync(`npx prisma db push --schema=${schema}`, { stdio: 'inherit' });
