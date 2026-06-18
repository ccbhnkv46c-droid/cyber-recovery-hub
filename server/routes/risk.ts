import { Router, Response } from 'express';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { hasPermission, isAssignedOnlyRole, normalizeRole } from '../../lib/rbac';
import {
  applyRiskFilters,
  buildRoleScopedWhere,
  loadEnrichedOpenFindings,
  sortByRiskScore,
} from '../services/risk/enrichment';
import prisma from '../../lib/prisma';

const router = Router();

function canViewRisk(role: string): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'ADMIN'
    || hasPermission(normalized, 'view_all')
    || hasPermission(normalized, 'view_assigned')
    || hasPermission(normalized, 'view_team')
    || hasPermission(normalized, 'view_org');
}

router.get('/prioritisation', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (!canViewRisk(user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const filters = req.query as Record<string, string>;
  const where = buildRoleScopedWhere(user);
  let enriched = await loadEnrichedOpenFindings(where);
  enriched = applyRiskFilters(enriched, filters);
  enriched = sortByRiskScore(enriched);

  const top10 = enriched.slice(0, 10);

  const serviceMap: Record<string, { name: string; maxScore: number; count: number; total: number }> = {};
  const assetMap: Record<string, { name: string; maxScore: number; count: number; total: number }> = {};

  for (const f of enriched) {
    const svc = (f.service as { id?: string; name?: string }) || {};
    if (svc.id) {
      if (!serviceMap[svc.id]) serviceMap[svc.id] = { name: svc.name || 'Unknown', maxScore: 0, count: 0, total: 0 };
      serviceMap[svc.id].maxScore = Math.max(serviceMap[svc.id].maxScore, f.exposureRiskScore);
      serviceMap[svc.id].count++;
      serviceMap[svc.id].total += f.exposureRiskScore;
    }
    const asset = f.assetRecord as { id?: string; name?: string } | null;
    if (asset?.id) {
      if (!assetMap[asset.id]) assetMap[asset.id] = { name: asset.name || 'Unknown', maxScore: 0, count: 0, total: 0 };
      assetMap[asset.id].maxScore = Math.max(assetMap[asset.id].maxScore, f.exposureRiskScore);
      assetMap[asset.id].count++;
      assetMap[asset.id].total += f.exposureRiskScore;
    }
  }

  const highestRiskServices = Object.entries(serviceMap)
    .map(([id, s]) => ({ id, name: s.name, maxScore: s.maxScore, avgScore: Math.round(s.total / s.count), count: s.count }))
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 10);

  const highestRiskAssets = Object.entries(assetMap)
    .map(([id, a]) => ({ id, name: a.name, maxScore: a.maxScore, avgScore: Math.round(a.total / a.count), count: a.count }))
    .sort((a, b) => b.maxScore - a.maxScore)
    .slice(0, 10);

  const highRiskOverdue = enriched.filter((f) => f.isOverdue && (f.exposureRiskRating === 'High' || f.exposureRiskRating === 'Critical')).slice(0, 20);
  const internetFacingHighRisk = enriched.filter((f) =>
    ((f.assetRecord as { internetFacing?: boolean })?.internetFacing || f.exposureLevel === 'INTERNET_FACING')
    && (f.exposureRiskRating === 'High' || f.exposureRiskRating === 'Critical'),
  ).slice(0, 20);
  const threatIntelDriven = enriched.filter((f) => f.hasThreatMatch && f.exposureRiskRating !== 'Low').slice(0, 20);
  const ransomwareLinked = enriched.filter((f) =>
    (f.threatIntelligence as { ransomwareAssociated?: boolean } | null)?.ransomwareAssociated,
  ).slice(0, 20);
  const criticalServiceRisks = enriched.filter((f) =>
    (f.assetRecord as { criticalService?: boolean })?.criticalService
    && (f.exposureRiskRating === 'High' || f.exposureRiskRating === 'Critical'),
  ).slice(0, 20);

  const filterMeta = isAssignedOnlyRole(user.role)
    ? { services: [], assets: [], owners: [] }
    : {
      services: await prisma.service.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      assets: await prisma.asset.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' }, take: 200 }),
      owners: await prisma.user.findMany({
        where: { role: { in: ['SME', 'ENGINEER'] }, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    };

  res.json({
    top10,
    highestRiskServices,
    highestRiskAssets,
    highRiskOverdue,
    internetFacingHighRisk,
    threatIntelDriven,
    ransomwareLinked,
    criticalServiceRisks,
    total: enriched.length,
    filterMeta,
    canExport: normalizeRole(user.role) === 'ADMIN',
  });
});

router.get('/export', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const filters = req.query as Record<string, string>;
  const where = buildRoleScopedWhere(req.user!);
  let enriched = await loadEnrichedOpenFindings(where);
  enriched = applyRiskFilters(enriched, filters);
  enriched = sortByRiskScore(enriched);

  const header = [
    'Finding ID', 'Title', 'Risk Score', 'Risk Rating', 'Risk Reason', 'Severity', 'CVSS',
    'Service', 'Asset', 'Asset Criticality', 'Exposure', 'Threat Priority', 'Owner', 'Status', 'Overdue',
  ].join(',');

  const rows = enriched.map((f) => {
    const service = (f.service as { name?: string })?.name || '';
    const asset = f.assetRecord as { name?: string; businessCriticality?: string } | null;
    const owner = (f.owner as { name?: string })?.name || '';
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    return [
      f.findingId,
      escape(f.title as string),
      f.exposureRiskScore,
      f.exposureRiskRating,
      escape(f.exposureRiskReason),
      f.severity,
      f.cvssScore,
      escape(service),
      escape(asset?.name || ''),
      asset?.businessCriticality || '',
      f.exposureLevel || '',
      f.threatPriority || '',
      escape(owner),
      f.status,
      f.isOverdue ? 'Yes' : 'No',
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="risk-prioritisation-${new Date().toISOString().split('T')[0]}.csv"`);
  res.send(csv);
});

export default router;
