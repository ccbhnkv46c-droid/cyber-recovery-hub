import 'dotenv/config';

function firstOrigin(value: string): string {
  return value.split(',')[0]?.trim() || 'http://localhost:3000';
}

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const apiPort = parseInt(process.env.API_PORT || '3001', 10);
const apiUrl = process.env.API_URL || `http://127.0.0.1:${apiPort}`;

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',

  appUrl,
  apiUrl,
  apiPort,
  apiHost: process.env.API_HOST || '0.0.0.0',
  webPort: parseInt(process.env.PORT || '3000', 10),
  trustProxy: process.env.TRUST_PROXY !== 'false',
  corsOrigins: (process.env.CORS_ORIGINS || appUrl).split(',').map((o) => o.trim()),

  databaseUrl: process.env.DATABASE_URL || '',

  redisUrl: process.env.REDIS_URL || '',
  enableBackgroundJobs: process.env.ENABLE_BACKGROUND_JOBS !== 'false',

  entra: {
    enabled: !!(process.env.ENTRA_CLIENT_ID && process.env.ENTRA_CLIENT_SECRET && process.env.ENTRA_TENANT_ID),
    tenantId: process.env.ENTRA_TENANT_ID || '',
    clientId: process.env.ENTRA_CLIENT_ID || '',
    clientSecret: process.env.ENTRA_CLIENT_SECRET || '',
    redirectUri:
      process.env.ENTRA_REDIRECT_URI || `${firstOrigin(process.env.CORS_ORIGINS || appUrl)}/api/auth/entra/callback`,
    defaultRole: process.env.ENTRA_DEFAULT_ROLE || 'ENGINEER',
  },

  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'local') as 'local' | 's3' | 'azure',
    localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
    s3Bucket: process.env.S3_BUCKET || '',
    s3Region: process.env.S3_REGION || 'eu-west-1',
    azureContainer: process.env.AZURE_STORAGE_CONTAINER || '',
    azureConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  },

  notifications: {
    emailEnabled: process.env.EMAIL_ENABLED === 'true',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
    emailFrom: process.env.EMAIL_FROM || 'cyber-recovery@bank.com',
    cyberRecoveryTeamEmail: process.env.CYBER_RECOVERY_TEAM_EMAIL || 'cyber-recovery@bank.com',
    teamsWebhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
  },

  copilot: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  virusScan: {
    enabled: process.env.VIRUS_SCAN_ENABLED === 'true',
    clamavHost: process.env.CLAMAV_HOST || 'localhost',
    clamavPort: parseInt(process.env.CLAMAV_PORT || '3310', 10),
  },
};

export function validateProductionConfig(): string[] {
  const warnings: string[] = [];
  if (!config.isProduction) return warnings;

  if (!config.databaseUrl) {
    warnings.push('DATABASE_URL is required in production (use PostgreSQL).');
  } else if (config.databaseUrl.startsWith('file:')) {
    warnings.push('SQLite (file:...) is not supported in hosted environments — use PostgreSQL.');
  }

  if (!config.corsOrigins.length || config.corsOrigins[0].includes('localhost')) {
    warnings.push('Set CORS_ORIGINS and APP_URL to your public application URL.');
  }

  if (!config.entra.enabled) {
    warnings.push('Entra ID SSO is not configured — production should use SSO instead of dev passwords.');
  }

  if (!config.notifications.emailEnabled) {
    warnings.push('EMAIL_ENABLED is false — SME update notifications will only appear in the dashboard.');
  }

  return warnings;
}
