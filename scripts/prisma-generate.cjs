const { execSync } = require('child_process');
const { resolvePrismaSchema } = require('./prisma-schema.cjs');

const schema = resolvePrismaSchema();
console.log(`[prisma] generate → ${schema}`);
execSync(`npx prisma generate --schema=${schema}`, { stdio: 'inherit' });
