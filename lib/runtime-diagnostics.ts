import fs from 'fs';
import path from 'path';

/** Startup diagnostics for Docker/Railway Prisma engine debugging */
export function logRuntimeDiagnostics(): void {
  console.log(`[Runtime] platform: ${process.platform}`);

  try {
    const report = process.report.getReport() as {
      header?: { glibcVersionRuntime?: string };
    };
    const glibc = report.header?.glibcVersionRuntime;
    console.log(`[Runtime] glibcVersionRuntime: ${glibc ?? 'n/a'}`);
  } catch {
    console.log('[Runtime] glibcVersionRuntime: n/a');
  }

  const dbUrl = process.env.DATABASE_URL || '';
  const scheme = dbUrl.includes('://') ? dbUrl.split('://')[0] : '(unset)';
  console.log(`[Runtime] DATABASE_URL prefix: ${scheme}://`);

  try {
    const clientDir = path.join(process.cwd(), 'node_modules/.prisma/client');
    const engines = fs.readdirSync(clientDir).filter((f) => f.includes('query_engine'));
    console.log(`[Runtime] Prisma query engines: ${engines.join(', ') || 'none'}`);
  } catch {
    console.log('[Runtime] Prisma query engines: (unable to read)');
  }
}
