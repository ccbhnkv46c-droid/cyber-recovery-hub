import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, auditLog, requireRoles, AuthRequest } from '../middleware/auth';
import { ACTIVITY_TYPES } from '../../lib/services';
import { recordActivity, notifyFindingUpdate } from '../services/findings/activity';

const router = Router();

router.post('/assign', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { findingIds, ownerId } = req.body;

  if (!Array.isArray(findingIds) || findingIds.length === 0) {
    return res.status(400).json({ error: 'findingIds array is required' });
  }
  if (!ownerId) return res.status(400).json({ error: 'ownerId (SME) is required' });

  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) return res.status(404).json({ error: 'SME not found' });
  if (owner.role !== 'SME' && owner.role !== 'ENGINEER') {
    return res.status(400).json({ error: 'Assignments must target an SME account' });
  }

  const findings = await prisma.finding.findMany({
    where: { OR: [{ id: { in: findingIds } }, { findingId: { in: findingIds } }] },
  });

  const now = new Date();
  const updated = [];

  for (const finding of findings) {
    const result = await prisma.finding.update({
      where: { id: finding.id },
      data: {
        ownerId,
        assignedById: req.user!.id,
        assignedAt: now,
        status: finding.status === 'OPEN' ? 'IN_PROGRESS' : finding.status,
        nextAction: `Assigned to ${owner.name} for remediation`,
      },
      include: {
        owner: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    await recordActivity({
      findingId: finding.id,
      userId: req.user!.id,
      type: ACTIVITY_TYPES.ASSIGNED,
      content: `Assigned to ${owner.name}`,
      metadata: { ownerId, bulk: findingIds.length > 1 },
    });

    await notifyFindingUpdate(finding.id, req.user!.id, `Assigned to ${owner.name}`);
    updated.push(result);
  }

  await auditLog({
    userId: req.user!.id,
    action: 'BULK_ASSIGN',
    entityType: 'Finding',
    newValue: JSON.stringify({ count: updated.length, ownerId, ownerName: owner.name }),
    ipAddress: req.ip,
  });

  res.json({ assigned: updated.length, owner: { id: owner.id, name: owner.name }, findings: updated });
});

export default router;
