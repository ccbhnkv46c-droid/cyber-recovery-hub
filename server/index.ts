import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import entraRoutes from './routes/entra';
import findingsRoutes from './routes/findings';
import dashboardRoutes from './routes/dashboard';
import copilotRoutes from './routes/copilot';
import notificationsRoutes from './routes/notifications';
import escalationsRoutes from './routes/escalations';
import integrationsRoutes from './routes/integrations';
import adminRoutes from './routes/admin';
import approvalsRoutes from './routes/approvals';
import filesRoutes from './routes/files';
import servicesRoutes from './routes/services';
import assetsRoutes from './routes/assets';
import threatIntelRoutes from './routes/threat-intel';
import importRoutes from './routes/import';
import bulkRoutes from './routes/bulk';
import prisma from '../lib/prisma';
import { config, validateProductionConfig } from '../lib/config';
import { logRuntimeDiagnostics } from '../lib/runtime-diagnostics';
import { initJobQueue, shutdownJobQueue } from './services/queue/jobQueue';
import { cleanupExpiredSessions } from './middleware/auth';

const app = express();

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

app.use('/api/auth/login', (req, res, next) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (record && record.resetAt > now && record.count >= 10) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  if (!record || record.resetAt <= now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.count++;
  }
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      service: 'Cyber Recover API',
      version: '1.2.0',
      database: 'connected',
      environment: config.isDev ? 'development' : 'production',
      features: {
        entraSso: config.entra.enabled,
        redisQueue: !!config.redisUrl,
        emailNotifications: config.notifications.emailEnabled,
        teamsNotifications: !!config.notifications.teamsWebhookUrl,
        llmCopilot: !!config.copilot.openaiApiKey,
        virusScan: config.virusScan.enabled,
        storage: config.storage.provider,
      },
    });
  } catch {
    res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/auth/entra', entraRoutes);
app.use('/api/findings', findingsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/threat-intel', threatIntelRoutes);
app.use('/api/import', importRoutes);
app.use('/api/bulk', bulkRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API Error]', err.message);
  res.status(500).json({ error: config.isDev ? err.message : 'Internal server error' });
});

initJobQueue().catch(console.error);

if (config.isProduction) {
  for (const warning of validateProductionConfig()) {
    console.warn(`[Production] ${warning}`);
  }
}

logRuntimeDiagnostics();

const server = app.listen(config.apiPort, config.apiHost, () => {
  console.log(`[API] Listening on http://${config.apiHost}:${config.apiPort}`);
  console.log(`Cyber Recover API v1.2.0 on http://${config.apiHost}:${config.apiPort}`);
  console.log(`  App URL: ${config.appUrl}`);
  console.log(`  API rewrite target: ${config.apiRewriteUrl}`);
  console.log(`  CORS origins: ${config.corsOrigins.join(', ')}`);
  console.log(`  SSO: ${config.entra.enabled ? 'Entra ID enabled' : 'Dev auth only'}`);
  console.log(`  Queue: ${config.redisUrl ? 'Redis/BullMQ' : 'In-process'}`);
  console.log(`  Copilot: ${config.copilot.openaiApiKey ? 'LLM + grounded' : 'Analytics engine'}`);
  console.log(`  Email: ${config.notifications.emailEnabled ? 'SMTP enabled' : 'Console only'}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  console.error(`[API] Failed to bind ${config.apiHost}:${config.apiPort}:`, err.message);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[API] uncaughtException:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[API] unhandledRejection:', reason);
});

process.on('SIGTERM', async () => {
  await shutdownJobQueue();
  server.close();
});

export default app;
