import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../lib/config';
import prisma from '../../lib/prisma';
import { auditLog, AuthRequest } from '../middleware/auth';

const router = Router();

const ENTRA_ROLE_MAP: Record<string, string> = {
  'CRH-Security-Analysts': 'SECURITY_ANALYST',
  'CRH-Engineers': 'ENGINEER',
  'CRH-Team-Leaders': 'TEAM_LEADER',
  'CRH-Engineering-Managers': 'ENGINEERING_MANAGER',
  'CRH-CISO': 'CISO',
  'CRH-Board': 'BOARD',
  'CRH-Admins': 'ADMIN',
};

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'BOARD': return '/board';
    case 'ENGINEER': return '/my-actions';
    default: return '/dashboard';
  }
}

router.get('/login', (_req, res) => {
  if (!config.entra.enabled) {
    return res.status(503).json({ error: 'Entra ID SSO not configured' });
  }

  const { tenantId, clientId, redirectUri } = config.entra;
  const state = uuidv4();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email User.Read',
    state,
    response_mode: 'query',
  });

  res.redirect(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`);
});

router.get('/callback', async (req, res: Response) => {
  if (!config.entra.enabled) {
    return res.redirect(`${config.corsOrigins[0]}/login?error=sso_not_configured`);
  }

  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${config.corsOrigins[0]}/login?error=no_code`);
  }

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${config.entra.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.entra.clientId,
          client_secret: config.entra.clientSecret,
          code,
          redirect_uri: config.entra.redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid profile email User.Read',
        }),
      }
    );

    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return res.redirect(`${config.corsOrigins[0]}/login?error=token_failed`);
    }

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const email = (profile.mail || profile.userPrincipalName || '').toLowerCase();
    const name = profile.displayName || email;
    const entraId = profile.id;

    let user = await prisma.user.findFirst({
      where: { OR: [{ entraId }, { email }] },
    });

    if (!user) {
      const defaultRole = config.entra.defaultRole;
      user = await prisma.user.create({
        data: {
          email,
          name,
          entraId,
          authProvider: 'entra',
          role: defaultRole,
          department: 'Cyber Security',
        },
      });
    } else if (!user.entraId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { entraId, authProvider: 'entra' },
      });
    }

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8);

    await prisma.session.create({
      data: { userId: user.id, token, ipAddress: req.ip || '127.0.0.1', expiresAt },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    await auditLog({
      userId: user.id,
      action: 'LOGIN_SSO',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    const frontendUrl = config.corsOrigins[0];
    const defaultRoute = getDefaultRoute(user.role);
    res.redirect(
      `${frontendUrl}/login/callback?token=${token}&route=${defaultRoute}&name=${encodeURIComponent(user.name)}&role=${user.role}`
    );
  } catch (err) {
    console.error('[Entra SSO]', err);
    res.redirect(`${config.corsOrigins[0]}/login?error=sso_failed`);
  }
});

router.get('/status', (_req, res: Response) => {
  res.json({
    enabled: config.entra.enabled,
    provider: 'Microsoft Entra ID',
    loginUrl: config.entra.enabled ? '/api/auth/entra/login' : null,
  });
});

export default router;
