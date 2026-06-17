import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/users', authMiddleware, requireRoles('ADMIN'), async (_req, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      department: true,
      isActive: true,
      team: { select: { name: true } },
      lastLoginAt: true,
    },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.get('/teams', authMiddleware, async (_req, res: Response) => {
  const teams = await prisma.team.findMany({
    include: { _count: { select: { members: true, findings: true } } },
  });
  res.json(teams);
});

router.get('/applications', authMiddleware, async (_req, res: Response) => {
  const apps = await prisma.application.findMany({
    include: { _count: { select: { findings: true } } },
  });
  res.json(apps);
});

router.get('/audit-logs', authMiddleware, requireRoles('ADMIN'), async (req, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: parseInt((req.query.limit as string) || '100'),
  });
  res.json(logs);
});

router.get('/email-outbox', authMiddleware, requireRoles('ADMIN'), async (_req, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'EMAIL_SENT' },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json(logs);
});

router.get('/filters', authMiddleware, async (_req, res: Response) => {
  const [businessAreas, technologies, applications, owners, services, managers, assets] = await Promise.all([
    prisma.finding.findMany({ select: { businessArea: true }, distinct: ['businessArea'] }),
    prisma.finding.findMany({ select: { technology: true }, distinct: ['technology'] }),
    prisma.application.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: { in: ['SME', 'ENGINEER'] }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.service.findMany({ where: { isActive: true }, select: { id: true, name: true, businessArea: true } }),
    prisma.user.findMany({
      where: { role: 'ENGINEERING_MANAGER' },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      where: { isActive: true },
      select: { id: true, name: true, serviceId: true, businessCriticality: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({
    businessAreas: businessAreas.map((b) => b.businessArea).filter(Boolean),
    technologies: technologies.map((t) => t.technology).filter(Boolean),
    applications,
    owners,
    services,
    managers,
    assets,
  });
});

export default router;
