import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../../lib/prisma';
import { authMiddleware, auditLog, AuthRequest } from '../middleware/auth';
import { config } from '../../lib/config';

const router = Router();
const isDev = process.env.NODE_ENV !== 'production';

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.isActive || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await auditLog({
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 8);

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      ipAddress: req.ip || '127.0.0.1',
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await auditLog({
    userId: user.id,
    action: 'LOGIN',
    entityType: 'User',
    entityId: user.id,
    ipAddress: req.ip,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      teamId: user.teamId,
      department: user.department,
    },
    expiresAt,
    defaultRoute: getDefaultRoute(user.role),
  });
});

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'BOARD': return '/board';
    case 'SME':
    case 'ENGINEER': return '/my-actions';
    case 'ADMIN': return '/dashboard';
    default: return '/dashboard';
  }
}

router.post('/logout', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.sessionToken) {
    await prisma.session.deleteMany({ where: { token: req.sessionToken } });
    await auditLog({
      userId: req.user!.id,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: req.user!.id,
      ipAddress: req.ip,
    });
  }
  res.json({ success: true });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
      department: true,
      team: { select: { id: true, name: true, businessArea: true } },
    },
  });
  res.json(user);
});

router.get('/sso-status', (_req, res) => {
  res.json({
    entraEnabled: config.entra.enabled,
    devAuthEnabled: true,
  });
});

if (isDev) {
  router.get('/demo-users', (_req, res) => {
    res.json([
      { email: 'administrator@crh.bank.com', role: 'Administrator', name: 'Administrator' },
      { email: 'richard.knight@crh.bank.com', role: 'SME', name: 'Richard Knight' },
      { email: 'sammi.powell@crh.bank.com', role: 'SME', name: 'Sammi Powell' },
      { email: 'michael.oconnor@crh.bank.com', role: 'SME', name: "Michael O'Connor" },
      { email: 'steven.k@crh.bank.com', role: 'SME', name: 'Steven K' },
      { email: 'analyst@bank.com', role: 'Security Analyst', name: 'Sarah Chen' },
      { email: 'ciso@bank.com', role: 'CISO', name: 'Michael Richardson' },
    ]);
  });
}

export default router;
