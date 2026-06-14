import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    include: {
      finding: { select: { findingId: true, title: true, severity: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(notifications);
});

router.get('/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  const count = await prisma.notification.count({
    where: { userId: req.user!.id, isRead: false },
  });
  res.json({ count });
});

router.patch('/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId: req.user!.id },
    data: { isRead: true },
  });
  res.json({ success: true });
});

router.patch('/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true },
  });
  res.json({ success: true });
});

export default router;
