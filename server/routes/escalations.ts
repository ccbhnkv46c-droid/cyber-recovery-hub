import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const escalations = await prisma.escalationEvent.findMany({
    include: {
      finding: {
        select: {
          findingId: true,
          title: true,
          severity: true,
          owner: { select: { name: true } },
          team: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const activeEscalations = await prisma.finding.findMany({
    where: { escalationLevel: { not: 'NONE' }, status: { notIn: ['CLOSED', 'REMEDIATED'] } },
    include: {
      owner: { select: { name: true } },
      team: { select: { name: true } },
    },
    orderBy: { escalationLevel: 'desc' },
  });

  res.json({ events: escalations, active: activeEscalations });
});

export default router;
