import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { ACTIVE_STATUSES } from '../../lib/constants';
import { authMiddleware, auditLog, requirePermission, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/pending', authMiddleware, requirePermission('approve_extension', 'approve_exceptions'), async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const where: Record<string, unknown> = {
    status: { in: ['PENDING_EXCEPTION', 'PENDING_REVIEW'] },
  };

  if (user.role === 'TEAM_LEADER' && user.teamId) {
    where.teamId = user.teamId;
  } else if (user.role === 'ENGINEERING_MANAGER' && user.department) {
    where.businessArea = user.department;
  }

  const pending = await prisma.finding.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      application: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json(pending);
});

router.post('/:id/approve-extension', authMiddleware, requirePermission('approve_extension'), async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: String(req.params.id) }, { findingId: String(req.params.id) }] },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  const newTargetDate = req.body.newTargetDate ? new Date(req.body.newTargetDate) : finding.targetDate;
  const updated = await prisma.finding.update({
    where: { id: finding.id },
    data: {
      targetDate: newTargetDate,
      status: 'IN_PROGRESS',
      nextAction: 'Extension approved — remediation in progress',
    },
  });

  if (finding.ownerId) {
    await prisma.notification.create({
      data: {
        userId: finding.ownerId,
        findingId: finding.id,
        title: `Extension Approved: ${finding.findingId}`,
        message: `Your extension request for ${finding.findingId} has been approved. New target: ${newTargetDate.toLocaleDateString('en-GB')}`,
        channel: 'DASHBOARD',
      },
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'APPROVE_EXTENSION',
    entityType: 'Finding',
    entityId: finding.id,
    oldValue: finding.targetDate.toISOString(),
    newValue: newTargetDate.toISOString(),
    ipAddress: req.ip,
  });

  res.json(updated);
});

router.post('/:id/approve-exception', authMiddleware, requirePermission('approve_exceptions'), async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: String(req.params.id) }, { findingId: String(req.params.id) }], status: 'PENDING_EXCEPTION' },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found or not pending exception' });

  const expiryDays = parseInt(req.body.expiryDays || '90');
  const exceptionExpiry = new Date();
  exceptionExpiry.setDate(exceptionExpiry.getDate() + expiryDays);

  const updated = await prisma.finding.update({
    where: { id: finding.id },
    data: {
      status: 'RISK_ACCEPTED',
      riskAccepted: true,
      riskAcceptedAt: new Date(),
      riskAcceptedBy: req.user!.name,
      exceptionExpiry,
      exceptionReason: req.body.reason || finding.exceptionReason,
    },
  });

  if (finding.ownerId) {
    await prisma.notification.create({
      data: {
        userId: finding.ownerId,
        findingId: finding.id,
        title: `Exception Approved: ${finding.findingId}`,
        message: `Risk acceptance approved for ${finding.findingId}. Expires: ${exceptionExpiry.toLocaleDateString('en-GB')}`,
        channel: 'DASHBOARD',
      },
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'APPROVE_EXCEPTION',
    entityType: 'Finding',
    entityId: finding.id,
    newValue: JSON.stringify({ exceptionExpiry, approvedBy: req.user!.name }),
    ipAddress: req.ip,
  });

  res.json(updated);
});

router.post('/:id/reject', authMiddleware, requirePermission('approve_extension', 'approve_exceptions'), async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: String(req.params.id) }, { findingId: String(req.params.id) }] },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  const updated = await prisma.finding.update({
    where: { id: finding.id },
    data: {
      status: 'IN_PROGRESS',
      nextAction: `Request rejected: ${req.body.reason || 'Please continue remediation'}`,
    },
  });

  if (finding.ownerId) {
    await prisma.notification.create({
      data: {
        userId: finding.ownerId,
        findingId: finding.id,
        title: `Request Rejected: ${finding.findingId}`,
        message: req.body.reason || 'Your request was rejected. Please continue remediation.',
        channel: 'DASHBOARD',
      },
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'REJECT_REQUEST',
    entityType: 'Finding',
    entityId: finding.id,
    newValue: req.body.reason,
    ipAddress: req.ip,
  });

  res.json(updated);
});

export default router;
