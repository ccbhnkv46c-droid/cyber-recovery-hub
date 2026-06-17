import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, auditLog, requireRoles, AuthRequest } from '../middleware/auth';
import { isAssignedOnlyRole } from '../../lib/rbac';
import { DEMO_THREAT_INTELLIGENCE, normalizeCve } from '../../lib/threat-intel';
import { getVisibleThreatCvesForUser } from '../services/threat-intel/enrichment';
import { Prisma } from '@prisma/client';

const router = Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  let where: Prisma.ThreatIntelligenceWhereInput = {};

  if (user.role === 'ADMIN' || user.role === 'CISO' || user.role === 'SECURITY_ANALYST') {
    where = {};
  } else if (isAssignedOnlyRole(user.role)) {
    const visibleCves = await getVisibleThreatCvesForUser(user.id, user.role);
    where = { cve: { in: visibleCves || [] } };
  } else if (user.role === 'TEAM_LEADER' && user.teamId) {
    const findings = await prisma.finding.findMany({
      where: { teamId: user.teamId, cve: { not: null } },
      select: { cve: true },
    });
    const cves = [...new Set(findings.map((f) => normalizeCve(f.cve)).filter((c): c is string => !!c))];
    where = { cve: { in: cves } };
  } else if (user.role === 'ENGINEERING_MANAGER' && user.department) {
    const findings = await prisma.finding.findMany({
      where: { businessArea: user.department, cve: { not: null } },
      select: { cve: true },
    });
    const cves = [...new Set(findings.map((f) => normalizeCve(f.cve)).filter((c): c is string => !!c))];
    where = { cve: { in: cves } };
  } else {
    return res.status(403).json({ error: 'Access denied' });
  }

  const search = (req.query.search as string) || '';
  if (search) {
    where.OR = [
      { cve: { contains: search } },
      { threatName: { contains: search } },
      { threatSource: { contains: search } },
      { threatActorAssociated: { contains: search } },
    ];
  }

  const records = await prisma.threatIntelligence.findMany({
    where,
    orderBy: [{ activeExploitation: 'desc' }, { lastUpdated: 'desc' }],
  });

  const linkedCounts = await prisma.finding.groupBy({
    by: ['cve'],
    where: { cve: { in: records.map((r) => r.cve) } },
    _count: { id: true },
  });
  const countMap = Object.fromEntries(
    linkedCounts.map((c) => [c.cve?.toUpperCase(), c._count.id]),
  );

  res.json(records.map((r) => ({
    ...r,
    linkedFindings: countMap[r.cve.toUpperCase()] || 0,
  })));
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const record = await prisma.threatIntelligence.findUnique({
    where: { id: String(req.params.id) },
  });
  if (!record) return res.status(404).json({ error: 'Threat intelligence record not found' });

  if (req.user!.role !== 'ADMIN' && req.user!.role !== 'CISO' && req.user!.role !== 'SECURITY_ANALYST') {
    if (isAssignedOnlyRole(req.user!.role)) {
      const visibleCves = await getVisibleThreatCvesForUser(req.user!.id, req.user!.role);
      if (!visibleCves?.includes(record.cve.toUpperCase())) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  res.json(record);
});

router.post('/', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const cve = normalizeCve(data.cve);
  if (!cve) return res.status(400).json({ error: 'CVE is required' });
  if (!data.threatName?.trim()) return res.status(400).json({ error: 'Threat name is required' });
  if (!data.threatSource?.trim()) return res.status(400).json({ error: 'Threat source is required' });

  const existing = await prisma.threatIntelligence.findUnique({ where: { cve } });
  if (existing) return res.status(409).json({ error: 'Threat intelligence for this CVE already exists' });

  const record = await prisma.threatIntelligence.create({
    data: {
      cve,
      threatName: data.threatName.trim(),
      threatSource: data.threatSource.trim(),
      activeExploitation: Boolean(data.activeExploitation),
      publicExploitAvailable: Boolean(data.publicExploitAvailable),
      ransomwareAssociated: Boolean(data.ransomwareAssociated),
      malwareAssociated: Boolean(data.malwareAssociated),
      threatActorAssociated: data.threatActorAssociated?.trim() || null,
      exploitMaturity: data.exploitMaturity || null,
      dateFirstSeen: data.dateFirstSeen ? new Date(data.dateFirstSeen) : null,
      intelligenceConfidence: data.intelligenceConfidence || 'MEDIUM',
      sourceReference: data.sourceReference || null,
      recommendedAction: data.recommendedAction || null,
    },
  });

  await auditLog({
    userId: req.user!.id,
    action: 'CREATE_THREAT_INTEL',
    entityType: 'ThreatIntelligence',
    entityId: record.id,
    newValue: record.cve,
    ipAddress: req.ip,
  });

  res.status(201).json(record);
});

router.patch('/:id', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const updateData: Prisma.ThreatIntelligenceUpdateInput = {};

  const fields = [
    'threatName', 'threatSource', 'activeExploitation', 'publicExploitAvailable',
    'ransomwareAssociated', 'malwareAssociated', 'threatActorAssociated', 'exploitMaturity',
    'intelligenceConfidence', 'sourceReference', 'recommendedAction',
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) {
      (updateData as Record<string, unknown>)[field] = data[field];
    }
  }
  if (data.dateFirstSeen !== undefined) {
    updateData.dateFirstSeen = data.dateFirstSeen ? new Date(data.dateFirstSeen) : null;
  }

  const record = await prisma.threatIntelligence.update({
    where: { id: String(req.params.id) },
    data: updateData,
  });

  await auditLog({
    userId: req.user!.id,
    action: 'UPDATE_THREAT_INTEL',
    entityType: 'ThreatIntelligence',
    entityId: record.id,
    newValue: record.cve,
    ipAddress: req.ip,
  });

  res.json(record);
});

router.delete('/:id', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const record = await prisma.threatIntelligence.delete({
    where: { id: String(req.params.id) },
  });

  await auditLog({
    userId: req.user!.id,
    action: 'DELETE_THREAT_INTEL',
    entityType: 'ThreatIntelligence',
    entityId: record.id,
    oldValue: record.cve,
    ipAddress: req.ip,
  });

  res.json({ deleted: true, cve: record.cve });
});

router.post('/seed-demo', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const created = [];
  const skipped = [];

  for (const demo of DEMO_THREAT_INTELLIGENCE) {
    const cve = normalizeCve(demo.cve)!;
    const existing = await prisma.threatIntelligence.findUnique({ where: { cve } });
    if (existing) {
      skipped.push(cve);
      continue;
    }
    const record = await prisma.threatIntelligence.create({
      data: {
        ...demo,
        cve,
        dateFirstSeen: new Date(Date.now() - Math.floor(Math.random() * 365) * 86400000),
      },
    });
    created.push(record);
  }

  await auditLog({
    userId: req.user!.id,
    action: 'SEED_THREAT_INTEL',
    entityType: 'ThreatIntelligence',
    newValue: `Created ${created.length}, skipped ${skipped.length}`,
    ipAddress: req.ip,
  });

  res.json({ created: created.length, skipped: skipped.length, records: created });
});

export default router;
