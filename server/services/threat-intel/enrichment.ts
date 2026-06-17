import prisma from '../../../lib/prisma';
import {
  ThreatIntelRecord,
  AssetContext,
  computeThreatPriority,
  normalizeCve,
  ThreatPriority,
} from '../../../lib/threat-intel';
import { ACTIVE_STATUSES } from '../../../lib/constants';
import { Prisma } from '@prisma/client';

export type ThreatIntelMap = Map<string, ThreatIntelRecord>;

export async function loadThreatIntelMap(): Promise<ThreatIntelMap> {
  const records = await prisma.threatIntelligence.findMany();
  return new Map(records.map((r) => [r.cve.toUpperCase(), r as ThreatIntelRecord]));
}

export function getThreatForFinding(
  finding: { cve?: string | null },
  map: ThreatIntelMap,
): ThreatIntelRecord | null {
  const cve = normalizeCve(finding.cve);
  if (!cve) return null;
  return map.get(cve) || null;
}

export function enrichFindingWithThreat<T extends Record<string, unknown>>(
  finding: T,
  map: ThreatIntelMap,
): T & {
  threatIntelligence: ThreatIntelRecord | null;
  threatPriority: ThreatPriority | null;
  hasThreatMatch: boolean;
} {
  const threat = getThreatForFinding(finding as { cve?: string | null }, map);
  const asset = finding.assetRecord as AssetContext | null | undefined;
  const threatPriority = computeThreatPriority(threat, asset);
  return {
    ...finding,
    threatIntelligence: threat,
    threatPriority,
    hasThreatMatch: !!threat,
  };
}

export async function getCvesMatchingThreatFilter(
  filter: 'threatMatched' | 'activeExploitation' | 'publicExploit' | 'ransomware' | 'threatActor',
): Promise<string[]> {
  const where: Prisma.ThreatIntelligenceWhereInput = {};
  switch (filter) {
    case 'threatMatched':
      break;
    case 'activeExploitation':
      where.activeExploitation = true;
      break;
    case 'publicExploit':
      where.publicExploitAvailable = true;
      break;
    case 'ransomware':
      where.ransomwareAssociated = true;
      break;
    case 'threatActor':
      where.AND = [
        { threatActorAssociated: { not: null } },
        { threatActorAssociated: { not: '' } },
      ];
      break;
  }
  const records = await prisma.threatIntelligence.findMany({
    where,
    select: { cve: true },
  });
  return records.map((r) => r.cve.toUpperCase());
}

export async function applyThreatFiltersToWhere(
  where: Prisma.FindingWhereInput,
  filters: Record<string, string>,
): Promise<void> {
  if (filters.threatMatched === 'true') {
    const cves = await getCvesMatchingThreatFilter('threatMatched');
    where.cve = { in: cves };
  }
  if (filters.activeExploitation === 'true') {
    const cves = await getCvesMatchingThreatFilter('activeExploitation');
    where.cve = { in: cves };
  }
  if (filters.publicExploit === 'true') {
    const cves = await getCvesMatchingThreatFilter('publicExploit');
    where.cve = { in: cves };
  }
  if (filters.ransomware === 'true') {
    const cves = await getCvesMatchingThreatFilter('ransomware');
    where.cve = { in: cves };
  }
  if (filters.threatActor === 'true') {
    const cves = await getCvesMatchingThreatFilter('threatActor');
    where.cve = { in: cves };
  }
  if (filters.threatPriority) {
    const map = await loadThreatIntelMap();
    const findings = await prisma.finding.findMany({
      where: { cve: { not: null } },
      select: {
        cve: true,
        assetRecord: {
          select: { businessCriticality: true, environment: true, internetFacing: true },
        },
      },
    });
    const matchingCves = findings
      .filter((f) => {
        const threat = getThreatForFinding(f, map);
        const priority = computeThreatPriority(threat, f.assetRecord);
        return priority === filters.threatPriority;
      })
      .map((f) => normalizeCve(f.cve))
      .filter((c): c is string => !!c);
    where.cve = { in: matchingCves };
  }
}

export async function getVisibleThreatCvesForUser(
  userId: string,
  role: string,
): Promise<string[] | null> {
  if (role === 'ADMIN' || role === 'CISO' || role === 'SECURITY_ANALYST') return null;
  const findings = await prisma.finding.findMany({
    where: { ownerId: userId, cve: { not: null } },
    select: { cve: true },
  });
  return [...new Set(findings.map((f) => normalizeCve(f.cve)).filter((c): c is string => !!c))];
}

export async function computeThreatDashboardMetrics(roleScopedWhere?: Prisma.FindingWhereInput) {
  const baseWhere: Prisma.FindingWhereInput = {
    status: { in: ACTIVE_STATUSES },
    cve: { not: null },
    ...roleScopedWhere,
  };

  const [findings, threatMap] = await Promise.all([
    prisma.finding.findMany({
      where: baseWhere,
      select: {
        cve: true,
        service: { select: { name: true, criticality: true } },
        assetRecord: {
          select: { internetFacing: true, businessCriticality: true, environment: true },
        },
      },
    }),
    loadThreatIntelMap(),
  ]);

  let activeExploitation = 0;
  let publicExploit = 0;
  let ransomwareLinked = 0;
  const criticalServices = new Set<string>();
  let internetFacingWithThreat = 0;

  for (const f of findings) {
    const threat = getThreatForFinding(f, threatMap);
    if (!threat) continue;
    if (threat.activeExploitation) {
      activeExploitation++;
      if (['CRITICAL', 'HIGH'].includes(f.service.criticality)) {
        criticalServices.add(f.service.name);
      }
    }
    if (threat.publicExploitAvailable) publicExploit++;
    if (threat.ransomwareAssociated) ransomwareLinked++;
    if (f.assetRecord?.internetFacing && threat.activeExploitation) {
      internetFacingWithThreat++;
    }
  }

  return {
    vulnerabilitiesWithActiveExploitation: activeExploitation,
    publicExploitAvailable: publicExploit,
    ransomwareLinkedVulnerabilities: ransomwareLinked,
    criticalServicesAffectedByActiveThreats: criticalServices.size,
    internetFacingAssetsWithActiveThreatIntel: internetFacingWithThreat,
  };
}
