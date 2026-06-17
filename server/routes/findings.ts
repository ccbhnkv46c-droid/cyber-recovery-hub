import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  calculateRiskScore,
  calculateTargetDate,
  getDaysRemaining,
  getSlaStatus,
  isOverdue,
  isClosedStatus,
  SLA_DAYS,
  Severity,
  FindingStatus,
  EscalationLevel,
} from '../../lib/constants';
import { authMiddleware, auditLog, AuthRequest, requireRoles } from '../middleware/auth';
import { Prisma } from '@prisma/client';
import { ACTIVITY_TYPES } from '../../lib/services';
import { recordActivity, notifyFindingUpdate } from '../services/findings/activity';
import { isAssignedOnlyRole } from '../../lib/rbac';
import { resolveAssetForFinding } from './assets';

const router = Router();

function paramId(req: AuthRequest): string {
  return String(req.params.id);
}

const findingInclude = {
  owner: { select: { id: true, name: true, email: true } },
  assignedBy: { select: { id: true, name: true, email: true } },
  manager: { select: { id: true, name: true, email: true } },
  businessOwner: { select: { id: true, name: true, email: true } },
  team: { select: { id: true, name: true, businessArea: true } },
  service: { select: { id: true, name: true, businessArea: true, criticality: true } },
  application: true,
  assetRecord: {
    select: {
      id: true,
      name: true,
      assetType: true,
      environment: true,
      internetFacing: true,
      businessCriticality: true,
      dataClassification: true,
      criticalService: true,
      hostingLocation: true,
      owner: true,
      sme: { select: { id: true, name: true } },
      technicalOwner: { select: { id: true, name: true } },
      businessOwner: { select: { id: true, name: true } },
    },
  },
  evidence: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' as const } },
  comments: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' as const } },
  activities: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' as const } },
  attachments: { include: { user: { select: { id: true, name: true } } } },
  auditLogs: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' as const }, take: 50 },
  escalations: { orderBy: { createdAt: 'desc' as const }, take: 20 },
};

function enrichFinding(finding: Record<string, unknown>) {
  const targetDate = finding.targetDate as Date;
  const severity = finding.severity as Severity;
  const status = finding.status as FindingStatus;
  const daysRemaining = getDaysRemaining(targetDate);
  const slaStatus = getSlaStatus(targetDate, severity);
  const overdue = isOverdue(targetDate, status);
  return {
    ...finding,
    daysRemaining,
    slaStatus,
    isOverdue: overdue,
    evidenceCount: (finding.evidence as unknown[])?.length || 0,
  };
}

function buildWhereClause(req: AuthRequest, filters: Record<string, string>): Prisma.FindingWhereInput {
  const where: Prisma.FindingWhereInput = {};
  const user = req.user!;

  switch (user.role) {
    case 'SME':
    case 'ENGINEER':
      where.ownerId = user.id;
      break;
    case 'TEAM_LEADER':
      if (user.teamId) where.teamId = user.teamId;
      break;
    case 'ENGINEERING_MANAGER':
      if (user.department) where.businessArea = user.department;
      break;
    case 'BOARD':
      where.id = '__no_access__';
      break;
  }

  if (filters.severity) where.severity = filters.severity as Severity;
  if (filters.status) where.status = filters.status as FindingStatus;
  if (filters.serviceId) where.serviceId = filters.serviceId;
  if (filters.assetId) where.assetId = filters.assetId;
  if (filters.service) where.service = { name: { contains: filters.service } };
  if (!isAssignedOnlyRole(user.role) && filters.ownerId) where.ownerId = filters.ownerId;
  if (!isAssignedOnlyRole(user.role) && filters.manager) where.manager = { name: { contains: filters.manager } };
  if (filters.critical === 'true') where.severity = 'CRITICAL';
  if (filters.application) where.application = { name: { contains: filters.application } };
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.exposureLevel) where.exposureLevel = filters.exposureLevel;
  if (!isAssignedOnlyRole(user.role) && filters.owner) where.owner = { name: { contains: filters.owner } };
  if (filters.technology) where.technology = { contains: filters.technology };
  if (filters.businessArea) where.businessArea = filters.businessArea;
  if (filters.overdue === 'true') {
    where.status = { in: ACTIVE_STATUSES };
    where.targetDate = { lt: new Date() };
  }
  if (filters.age) {
    const days = parseInt(filters.age);
    const date = new Date();
    date.setDate(date.getDate() - days);
    where.createdAt = { lte: date };
  }
  if (filters.search) {
    where.OR = [
      { findingId: { contains: filters.search } },
      { title: { contains: filters.search } },
      { description: { contains: filters.search } },
      { asset: { contains: filters.search } },
      { assetRecord: { name: { contains: filters.search } } },
    ];
  }

  return where;
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const filters = req.query as Record<string, string>;
  const page = parseInt(filters.page || '1');
  const limit = parseInt(filters.limit || '50');
  const skip = (page - 1) * limit;

  const where = buildWhereClause(req, filters);

  const [findings, total] = await Promise.all([
    prisma.finding.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        businessOwner: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
        application: { select: { id: true, name: true, businessService: true } },
        assetRecord: { select: { id: true, name: true, businessCriticality: true, environment: true, internetFacing: true } },
        evidence: { select: { id: true } },
      },
      orderBy: [{ severity: 'asc' }, { targetDate: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.finding.count({ where }),
  ]);

  res.json({
    findings: findings.map(enrichFinding),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: {
      OR: [{ id: paramId(req) }, { findingId: paramId(req) }],
    },
    include: findingInclude,
  });

  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  if (req.user!.role === 'BOARD') {
    return res.status(403).json({ error: 'Board role has read-only dashboard access' });
  }

  if (isAssignedOnlyRole(req.user!.role) && finding.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied — finding not assigned to you' });
  }

  if (req.user!.role === 'TEAM_LEADER' && req.user!.teamId && finding.teamId !== req.user!.teamId) {
    return res.status(403).json({ error: 'Access denied — finding outside your team' });
  }

  const result = enrichFinding(finding);
  if (isAssignedOnlyRole(req.user!.role)) {
    const { auditLogs, ...smeView } = result as Record<string, unknown> & { auditLogs?: unknown };
    return res.json(smeView);
  }

  res.json(result);
});

router.post('/', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const severity = (data.severity || 'MEDIUM') as Severity;

  if (!data.serviceId) {
    return res.status(400).json({ error: 'serviceId is required — every vulnerability must belong to a service' });
  }

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) return res.status(400).json({ error: 'Invalid serviceId' });

  let assetLink = { assetId: null as string | null, assetName: data.asset as string | null, exposureLevel: data.exposureLevel as string | null };
  try {
    assetLink = await resolveAssetForFinding(data.assetId, data.asset, data.serviceId, data.applicationId);
  } catch {
    return res.status(400).json({ error: 'Invalid assetId' });
  }

  const risk = calculateRiskScore({
    cvssScore: data.cvssScore || 5,
    exploitability: data.exploitability || 5,
    likelihood: data.likelihood || 5,
    exposure: data.exposure || 5,
    criticality: data.criticality || 5,
  });

  const count = await prisma.finding.count();
  const findingId = `CRH-${String(count + 1).padStart(5, '0')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  const finding = await prisma.finding.create({
    data: {
      findingId,
      title: data.title,
      description: data.description || '',
      businessImpact: data.businessImpact || '',
      technicalImpact: data.technicalImpact || '',
      severity,
      cvssScore: data.cvssScore || 5,
      exploitability: data.exploitability || 5,
      likelihood: data.likelihood || 5,
      exposure: data.exposure || 5,
      criticality: data.criticality || 5,
      ...risk,
      mitigation: data.mitigation,
      remediationPlan: data.remediationPlan,
      serviceId: data.serviceId,
      applicationId: data.applicationId,
      assetId: assetLink.assetId,
      exposureLevel: assetLink.exposureLevel || data.exposureLevel || null,
      businessService: data.businessService,
      technology: data.technology,
      asset: assetLink.assetName,
      businessArea: data.businessArea,
      ownerId: data.ownerId,
      assignedById: data.ownerId ? req.user!.id : undefined,
      assignedAt: data.ownerId ? new Date() : undefined,
      dateIdentified: data.dateIdentified ? new Date(data.dateIdentified) : new Date(),
      teamId: data.teamId,
      managerId: data.managerId,
      businessOwnerId: data.businessOwnerId,
      priority: data.priority || severity,
      nextSteps: data.nextSteps,
      slaDays: SLA_DAYS[severity],
      targetDate: data.targetDate ? new Date(data.targetDate) : calculateTargetDate(severity),
      nextAction: data.nextAction || 'Initial assessment required',
      status: 'OPEN',
    },
    include: findingInclude,
  });

  await recordActivity({
    findingId: finding.id,
    userId: req.user!.id,
    type: ACTIVITY_TYPES.CREATED,
    content: `Finding ${findingId} created`,
  });

  if (data.ownerId) {
    await recordActivity({
      findingId: finding.id,
      userId: req.user!.id,
      type: ACTIVITY_TYPES.ASSIGNED,
      content: 'Initial assignment on creation',
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'CREATE',
    entityType: 'Finding',
    entityId: finding.id,
    newValue: JSON.stringify({ findingId, title: data.title }),
    ipAddress: req.ip,
  });

  res.status(201).json(enrichFinding(finding));
});

router.patch('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const existing = await prisma.finding.findFirst({
    where: { OR: [{ id: paramId(req) }, { findingId: paramId(req) }] },
  });
  if (!existing) return res.status(404).json({ error: 'Finding not found' });

  const user = req.user!;
  if (isAssignedOnlyRole(user.role) && existing.ownerId !== user.id) {
    return res.status(403).json({ error: 'Cannot edit findings not assigned to you' });
  }

  const data = req.body;
  const updateData: Prisma.FindingUpdateInput = {};

  const smeFields = ['status', 'blockerReason', 'remediationPlan', 'nextAction', 'nextSteps', 'mitigation', 'progress', 'plannedCompletionDate'];
  const adminFields = [
    ...smeFields,
    'title', 'description', 'severity', 'ownerId', 'managerId', 'businessOwnerId',
    'teamId', 'targetDate', 'escalationLevel', 'serviceId', 'applicationId', 'assetId',
    'exposureLevel', 'priority',
  ];

  const allowedFields = user.role === 'ADMIN' ? adminFields : isAssignedOnlyRole(user.role) ? smeFields : adminFields;
  for (const field of allowedFields) {
    if (field === 'assetId') continue;
    if (data[field] !== undefined) {
      (updateData as Record<string, unknown>)[field] = data[field];
    }
  }

  if (data.ownerId && data.ownerId !== existing.ownerId && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only administrators can reassign vulnerabilities' });
  }

  if (data.status === 'BLOCKED') updateData.blockerSince = new Date();
  if (isClosedStatus(data.status)) {
    updateData.closedAt = new Date();
    updateData.actualCompletionDate = new Date();
    updateData.progress = 100;
  }
  if (data.ownerId && data.ownerId !== existing.ownerId) {
    updateData.assignedBy = { connect: { id: user.id } };
    updateData.assignedAt = new Date();
  }
  if (data.requestException) {
    updateData.status = 'PENDING_EXCEPTION';
    updateData.exceptionReason = data.exceptionReason;
  }
  if (data.requestExtension && data.newTargetDate) {
    updateData.targetDate = new Date(data.newTargetDate);
    updateData.nextAction = 'Extension requested - pending approval';
  }

  if (data.assetId !== undefined && user.role === 'ADMIN') {
    const serviceId = (data.serviceId as string) || existing.serviceId;
    try {
      const assetLink = await resolveAssetForFinding(
        data.assetId || undefined,
        data.asset,
        serviceId,
        (data.applicationId as string) || existing.applicationId,
      );
      if (data.assetId) {
        updateData.assetRecord = { connect: { id: assetLink.assetId! } };
      } else {
        updateData.assetRecord = { disconnect: true };
      }
      updateData.asset = assetLink.assetName;
      if (assetLink.exposureLevel) updateData.exposureLevel = assetLink.exposureLevel;
    } catch {
      return res.status(400).json({ error: 'Invalid assetId' });
    }
    delete (updateData as Record<string, unknown>).assetId;
  }

  const finding = await prisma.finding.update({
    where: { id: existing.id },
    data: updateData,
    include: findingInclude,
  });

  await auditLog({
    userId: user.id,
    findingId: finding.id,
    action: 'UPDATE',
    entityType: 'Finding',
    entityId: finding.id,
    oldValue: JSON.stringify({ status: existing.status }),
    newValue: JSON.stringify(data),
    ipAddress: req.ip,
  });

  if (data.status && data.status !== existing.status) {
    await recordActivity({
      findingId: finding.id,
      userId: user.id,
      type: ACTIVITY_TYPES.STATUS_CHANGE,
      content: `Status changed from ${existing.status} to ${data.status}`,
    });
  }
  if (data.ownerId && data.ownerId !== existing.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: data.ownerId }, select: { name: true } });
    await recordActivity({
      findingId: finding.id,
      userId: user.id,
      type: ACTIVITY_TYPES.ASSIGNED,
      content: `Reassigned to ${owner?.name || 'SME'}`,
    });
  }
  if (data.nextSteps && data.nextSteps !== existing.nextSteps) {
    await recordActivity({
      findingId: finding.id,
      userId: user.id,
      type: ACTIVITY_TYPES.NEXT_STEP,
      content: data.nextSteps,
    });
  }
  if (data.progress !== undefined && data.progress !== existing.progress) {
    await recordActivity({
      findingId: finding.id,
      userId: user.id,
      type: ACTIVITY_TYPES.PROGRESS_UPDATE,
      content: `Progress updated to ${data.progress}%`,
      metadata: { progress: data.progress },
    });
  }

  await notifyFindingUpdate(finding.id, user.id, data.nextSteps || data.nextAction);

  res.json(enrichFinding(finding));
});

router.post('/:id/comments', authMiddleware, async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: paramId(req) }, { findingId: paramId(req) }] },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  if (isAssignedOnlyRole(req.user!.role) && finding.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied — finding not assigned to you' });
  }

  const commentType = req.body.type || 'COMMENT';
  const comment = await prisma.comment.create({
    data: {
      findingId: finding.id,
      userId: req.user!.id,
      content: req.body.content,
      type: commentType,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  const activityType = commentType === 'BLOCKER' ? ACTIVITY_TYPES.BLOCKER
    : commentType === 'NEXT_STEP' ? ACTIVITY_TYPES.NEXT_STEP
    : commentType === 'PROGRESS_UPDATE' ? ACTIVITY_TYPES.PROGRESS_UPDATE
    : commentType === 'EVIDENCE' ? ACTIVITY_TYPES.EVIDENCE
    : req.user!.role === 'ENGINEERING_MANAGER' || req.user!.role === 'TEAM_LEADER'
      ? ACTIVITY_TYPES.MANAGER_COMMENT
      : ACTIVITY_TYPES.COMMENT;

  await recordActivity({
    findingId: finding.id,
    userId: req.user!.id,
    type: activityType,
    content: req.body.content,
    metadata: { commentId: comment.id, commentType },
  });

  if (commentType === 'NEXT_STEP') {
    await prisma.finding.update({
      where: { id: finding.id },
      data: { nextSteps: req.body.content },
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'COMMENT',
    entityType: 'Comment',
    newValue: req.body.content,
    ipAddress: req.ip,
  });

  await notifyFindingUpdate(finding.id, req.user!.id, req.body.content);

  res.status(201).json(comment);
});

router.post('/:id/evidence', authMiddleware, async (req: AuthRequest, res: Response) => {
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: paramId(req) }, { findingId: paramId(req) }] },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });
  if (isAssignedOnlyRole(req.user!.role) && finding.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied — finding not assigned to you' });
  }

  const evidence = await prisma.evidence.create({
    data: {
      findingId: finding.id,
      userId: req.user!.id,
      description: req.body.description,
      fileName: req.body.fileName || 'evidence.txt',
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await recordActivity({
    findingId: finding.id,
    userId: req.user!.id,
    type: ACTIVITY_TYPES.EVIDENCE,
    content: `Evidence uploaded: ${req.body.fileName || 'evidence.txt'}`,
  });

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'UPLOAD_EVIDENCE',
    entityType: 'Evidence',
    entityId: evidence.id,
    ipAddress: req.ip,
  });

  await notifyFindingUpdate(finding.id, req.user!.id, `Evidence uploaded: ${req.body.description}`);

  res.status(201).json(evidence);
});

router.delete('/:id', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const existing = await prisma.finding.findFirst({
    where: { OR: [{ id: paramId(req) }, { findingId: paramId(req) }] },
  });
  if (!existing) return res.status(404).json({ error: 'Finding not found' });

  await prisma.finding.delete({ where: { id: existing.id } });

  await auditLog({
    userId: req.user!.id,
    findingId: existing.id,
    action: 'DELETE',
    entityType: 'Finding',
    entityId: existing.id,
    oldValue: JSON.stringify({ findingId: existing.findingId, title: existing.title }),
    ipAddress: req.ip,
  });

  res.json({ deleted: true, findingId: existing.findingId });
});

router.post('/:id/escalate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const allowed = ['SECURITY_ANALYST', 'ADMIN', 'CISO'];
  if (!allowed.includes(req.user!.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: paramId(req) }, { findingId: paramId(req) }] },
    include: { owner: true },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  const { getNextEscalationLevel, generateEscalationMessage } = await import('../../lib/constants');
  const newLevel = getNextEscalationLevel(finding.escalationLevel as EscalationLevel);

  const message = generateEscalationMessage(
    newLevel,
    finding.findingId,
    finding.title,
    finding.owner?.name || 'Unassigned'
  );

  const [updated, escalation] = await Promise.all([
    prisma.finding.update({
      where: { id: finding.id },
      data: { escalationLevel: newLevel, lastEscalationAt: new Date() },
      include: findingInclude,
    }),
    prisma.escalationEvent.create({
      data: {
        findingId: finding.id,
        level: newLevel,
        message,
        sentTo: req.body.sentTo || 'auto-routing',
        channel: 'DASHBOARD',
      },
    }),
  ]);

  if (finding.ownerId) {
    await prisma.notification.create({
      data: {
        userId: finding.ownerId,
        findingId: finding.id,
        title: `Escalation: ${finding.findingId}`,
        message,
        channel: 'DASHBOARD',
      },
    });
  }

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'ESCALATE',
    entityType: 'Finding',
    oldValue: finding.escalationLevel,
    newValue: newLevel,
    ipAddress: req.ip,
  });

  res.json({ finding: enrichFinding(updated), escalation });
});

export default router;
