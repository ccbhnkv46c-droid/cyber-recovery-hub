import { calculateExposureRisk, RiskAssessment } from '../../../lib/risk-scoring';
import {
  ThreatIntelMap,
  enrichFindingWithThreat,
  loadThreatIntelMap,
} from '../threat-intel/enrichment';
import { ACTIVE_STATUSES, isOverdue, FindingStatus } from '../../../lib/constants';
import prisma from '../../../lib/prisma';
import { Prisma } from '@prisma/client';
import { isAssignedOnlyRole, normalizeRole } from '../../../lib/rbac';

export type EnrichedFinding = Record<string, unknown> & RiskAssessment & {
  threatIntelligence: unknown;
  threatPriority: string | null;
  hasThreatMatch: boolean;
  isOverdue: boolean;
};

export function enrichFindingWithRisk<T extends Record<string, unknown>>(
  finding: T,
  threatMap: ThreatIntelMap,
): EnrichedFinding {
  const withThreat = enrichFindingWithThreat(finding, threatMap);
  const targetDate = finding.targetDate as Date;
  const status = finding.status as FindingStatus;
  const overdue = (finding.isOverdue as boolean) ?? isOverdue(targetDate, status);

  const risk = calculateExposureRisk({
    severity: finding.severity as string,
    cvssScore: finding.cvssScore as number,
    status: finding.status as string,
    createdAt: finding.createdAt as Date,
    targetDate,
    exposureLevel: finding.exposureLevel as string | null,
    assetRecord: finding.assetRecord as Record<string, unknown> | null,
    threatIntelligence: withThreat.threatIntelligence,
    isOverdue: overdue,
  });

  return { ...withThreat, ...risk, isOverdue: overdue };
}

export async function enrichFindingsBatch(
  findings: Record<string, unknown>[],
  threatMap?: ThreatIntelMap,
): Promise<EnrichedFinding[]> {
  const map = threatMap || await loadThreatIntelMap();
  return findings.map((f) => enrichFindingWithRisk(f, map));
}

export function applyRiskFilters(
  findings: EnrichedFinding[],
  filters: Record<string, string>,
): EnrichedFinding[] {
  let result = findings;
  if (filters.riskRating) {
    result = result.filter((f) => f.exposureRiskRating === filters.riskRating);
  }
  if (filters.minRiskScore) {
    const min = parseInt(filters.minRiskScore);
    result = result.filter((f) => f.exposureRiskScore >= min);
  }
  if (filters.criticalService === 'true') {
    result = result.filter((f) => (f.assetRecord as { criticalService?: boolean })?.criticalService);
  }
  if (filters.internetFacing === 'true') {
    result = result.filter((f) =>
      (f.assetRecord as { internetFacing?: boolean })?.internetFacing
      || f.exposureLevel === 'INTERNET_FACING',
    );
  }
  if (filters.businessCriticality) {
    result = result.filter((f) =>
      (f.assetRecord as { businessCriticality?: string })?.businessCriticality === filters.businessCriticality,
    );
  }
  if (filters.overdue === 'true') {
    result = result.filter((f) => f.isOverdue);
  }
  if (filters.activeExploitation === 'true') {
    result = result.filter((f) => (f.threatIntelligence as { activeExploitation?: boolean } | null)?.activeExploitation);
  }
  if (filters.ransomware === 'true') {
    result = result.filter((f) => (f.threatIntelligence as { ransomwareAssociated?: boolean } | null)?.ransomwareAssociated);
  }
  if (filters.ownerId) {
    result = result.filter((f) => (f.owner as { id?: string } | null)?.id === filters.ownerId);
  }
  if (filters.serviceId) {
    result = result.filter((f) => (f.service as { id?: string } | null)?.id === filters.serviceId);
  }
  if (filters.assetId) {
    result = result.filter((f) => (f.assetRecord as { id?: string } | null)?.id === filters.assetId);
  }
  return result;
}

export function sortByRiskScore(findings: EnrichedFinding[]): EnrichedFinding[] {
  return [...findings].sort((a, b) => b.exposureRiskScore - a.exposureRiskScore);
}

export function buildRoleScopedWhere(user: { id: string; role: string; teamId?: string | null; department?: string | null }): Prisma.FindingWhereInput {
  const role = normalizeRole(user.role);
  const where: Prisma.FindingWhereInput = { status: { in: ACTIVE_STATUSES } };
  if (isAssignedOnlyRole(role)) where.ownerId = user.id;
  else if (role === 'TEAM_LEADER' && user.teamId) where.teamId = user.teamId;
  else if (role === 'ENGINEERING_MANAGER' && user.department) where.businessArea = user.department;
  return where;
}

const findingListInclude = {
  owner: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true } },
  businessOwner: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  service: { select: { id: true, name: true, criticality: true } },
  application: { select: { id: true, name: true, businessService: true } },
  assetRecord: {
    select: {
      id: true, name: true, businessCriticality: true, environment: true,
      internetFacing: true, criticalService: true, dataClassification: true,
    },
  },
  evidence: { select: { id: true } },
};

export async function loadEnrichedOpenFindings(
  where: Prisma.FindingWhereInput,
  threatMap?: ThreatIntelMap,
): Promise<EnrichedFinding[]> {
  const raw = await prisma.finding.findMany({
    where: { ...where, status: { in: ACTIVE_STATUSES } },
    include: findingListInclude,
  });
  return enrichFindingsBatch(raw as Record<string, unknown>[], threatMap);
}

export async function computeRiskDashboardMetrics(roleScopedWhere: Prisma.FindingWhereInput) {
  const enriched = await loadEnrichedOpenFindings(roleScopedWhere);
  const open = enriched;
  const closed = await prisma.finding.count({ where: { status: { notIn: ACTIVE_STATUSES } } });

  const criticalRisk = open.filter((f) => f.exposureRiskRating === 'Critical').length;
  const highRisk = open.filter((f) => f.exposureRiskRating === 'High').length;
  const avgScore = open.length
    ? Math.round(open.reduce((s, f) => s + f.exposureRiskScore, 0) / open.length)
    : 0;

  const serviceScores: Record<string, { name: string; total: number; count: number; max: number }> = {};
  const assetScores: Record<string, { name: string; total: number; count: number; max: number }> = {};
  const smeScores: Record<string, { name: string; total: number; count: number }> = {};
  const criticalityScores: Record<string, { name: string; total: number; count: number }> = {};

  for (const f of open) {
    const svc = (f.service as { name: string })?.name || 'Unknown';
    if (!serviceScores[svc]) serviceScores[svc] = { name: svc, total: 0, count: 0, max: 0 };
    serviceScores[svc].total += f.exposureRiskScore;
    serviceScores[svc].count++;
    serviceScores[svc].max = Math.max(serviceScores[svc].max, f.exposureRiskScore);

    const asset = f.assetRecord as { id?: string; name?: string } | null;
    if (asset?.id) {
      if (!assetScores[asset.id]) assetScores[asset.id] = { name: asset.name || 'Unknown', total: 0, count: 0, max: 0 };
      assetScores[asset.id].total += f.exposureRiskScore;
      assetScores[asset.id].count++;
      assetScores[asset.id].max = Math.max(assetScores[asset.id].max, f.exposureRiskScore);
    }

    const owner = (f.owner as { name?: string })?.name || 'Unassigned';
    if (!smeScores[owner]) smeScores[owner] = { name: owner, total: 0, count: 0 };
    smeScores[owner].total += f.exposureRiskScore;
    smeScores[owner].count++;

    const crit = (f.assetRecord as { businessCriticality?: string })?.businessCriticality || 'Unknown';
    if (!criticalityScores[crit]) criticalityScores[crit] = { name: crit, total: 0, count: 0 };
    criticalityScores[crit].total += f.exposureRiskScore;
    criticalityScores[crit].count++;
  }

  const topService = Object.values(serviceScores).sort((a, b) => b.max - a.max)[0];
  const topAsset = Object.values(assetScores).sort((a, b) => b.max - a.max)[0];
  const threatDrivenCritical = open.filter(
    (f) => f.exposureRiskRating === 'Critical' && f.hasThreatMatch,
  ).length;
  const overdueCritical = open.filter(
    (f) => f.exposureRiskRating === 'Critical' && f.isOverdue,
  ).length;

  return {
    criticalRiskFindings: criticalRisk,
    highRiskFindings: highRisk,
    averageRiskScore: avgScore,
    topExposedService: topService ? { name: topService.name, maxScore: topService.max, avgScore: Math.round(topService.total / topService.count) } : null,
    highestRiskAsset: topAsset ? { name: topAsset.name, maxScore: topAsset.max, avgScore: Math.round(topAsset.total / topAsset.count) } : null,
    threatDrivenCriticalRisks: threatDrivenCritical,
    overdueCriticalRisks: overdueCritical,
    riskByService: Object.values(serviceScores)
      .map((s) => ({ name: s.name, avgScore: Math.round(s.total / s.count), maxScore: s.max, count: s.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10),
    riskByAssetCriticality: Object.values(criticalityScores)
      .map((c) => ({ name: c.name, avgScore: Math.round(c.total / c.count), count: c.count }))
      .sort((a, b) => b.avgScore - a.avgScore),
    riskBySme: Object.values(smeScores)
      .map((s) => ({ name: s.name, avgScore: Math.round(s.total / s.count), count: s.count }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10),
    openRiskVsClosed: {
      openAvgScore: avgScore,
      openCount: open.length,
      closedCount: closed,
      openCritical: criticalRisk,
      openHigh: highRisk,
    },
  };
}
