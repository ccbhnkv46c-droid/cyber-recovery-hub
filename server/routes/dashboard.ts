import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  getDaysRemaining,
  isOverdue,
  getSlaBucket,
  calcMttrDays,
  FindingStatus,
} from '../../lib/constants';
import { authMiddleware, AuthRequest, requireRoles } from '../middleware/auth';
import { isAssignedOnlyRole } from '../../lib/rbac';

const router = Router();

router.get('/executive', authMiddleware, async (req: AuthRequest, res: Response) => {
  const findings = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    select: {
      severity: true,
      status: true,
      targetDate: true,
      businessArea: true,
      technology: true,
      teamId: true,
      createdAt: true,
      closedAt: true,
      recoveryScore: true,
      team: { select: { name: true } },
    },
  });

  const closedFindings = await prisma.finding.findMany({
    where: { status: { in: CLOSED_STATUSES } },
    select: { createdAt: true, closedAt: true, severity: true },
  });

  const severityCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let overdueCount = 0;
  let withinSla = 0;

  for (const f of findings) {
    severityCounts[f.severity]++;
    if (isOverdue(f.targetDate, f.status)) overdueCount++;
    else withinSla++;
  }

  const slaPercent = findings.length > 0 ? Math.round((withinSla / findings.length) * 100) : 100;

  let mttr = calcMttrDays(closedFindings);

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const closedThisMonth = await prisma.finding.count({
    where: { closedAt: { gte: thisMonth }, status: { in: CLOSED_STATUSES } },
  });
  const openedThisMonth = await prisma.finding.count({
    where: { createdAt: { gte: thisMonth } },
  });
  const riskReduction = Math.max(0, closedThisMonth - Math.floor(openedThisMonth * 0.3));

  res.json({
    cards: {
      critical: severityCounts.CRITICAL,
      high: severityCounts.HIGH,
      medium: severityCounts.MEDIUM,
      low: severityCounts.LOW,
      overdue: overdueCount,
      withinSlaPercent: slaPercent,
      mttr,
      riskReductionThisMonth: riskReduction,
      totalOpen: findings.length,
    },
  });
});

router.get('/charts', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const findings = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    select: {
      severity: true,
      businessArea: true,
      technology: true,
      targetDate: true,
      createdAt: true,
      team: { select: { name: true } },
      recoveryScore: true,
    },
  });

  const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
    name: s,
    value: findings.filter((f) => f.severity === s).length,
  }));

  const businessAreas = [...new Set(findings.map((f) => f.businessArea || 'Unknown'))];
  const byBusinessArea = businessAreas.map((area) => ({
    name: area,
    value: findings.filter((f) => (f.businessArea || 'Unknown') === area).length,
  }));

  const technologies = [...new Set(findings.map((f) => f.technology || 'Unknown'))];
  const byTechnology = technologies.slice(0, 10).map((tech) => ({
    name: tech,
    value: findings.filter((f) => (f.technology || 'Unknown') === tech).length,
  }));

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const [opened, closed] = await Promise.all([
      prisma.finding.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.finding.count({
        where: { closedAt: { gte: start, lt: end }, status: { in: CLOSED_STATUSES } },
      }),
    ]);

    monthlyTrend.push({
      month: start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      opened,
      closed,
      net: opened - closed,
    });
  }

  const ageingBuckets = [
    { name: '0-7 days', min: 0, max: 7 },
    { name: '8-30 days', min: 8, max: 30 },
    { name: '31-60 days', min: 31, max: 60 },
    { name: '61-90 days', min: 61, max: 90 },
    { name: '90+ days', min: 91, max: 9999 },
  ].map((bucket) => {
    const count = findings.filter((f) => {
      const age = Math.floor((Date.now() - f.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      return age >= bucket.min && age <= bucket.max;
    }).length;
    return { name: bucket.name, value: count };
  });

  const teamStats: Record<string, { open: number; overdue: number; closed: number }> = {};
  for (const f of findings) {
    const team = f.team?.name || 'Unassigned';
    if (!teamStats[team]) teamStats[team] = { open: 0, overdue: 0, closed: 0 };
    teamStats[team].open++;
    if (getDaysRemaining(f.targetDate) < 0) teamStats[team].overdue++;
  }

  const closedByTeam = await prisma.finding.groupBy({
    by: ['teamId'],
    where: { status: { in: CLOSED_STATUSES } },
    _count: true,
  });

  const teams = await prisma.team.findMany({ select: { id: true, name: true } });
  const teamNameMap = Object.fromEntries(teams.map((t) => [t.id, t.name]));

  for (const g of closedByTeam) {
    const name = g.teamId ? teamNameMap[g.teamId] || 'Unknown' : 'Unassigned';
    if (!teamStats[name]) teamStats[name] = { open: 0, overdue: 0, closed: 0 };
    teamStats[name].closed = g._count;
  }

  const teamArray = Object.entries(teamStats).map(([name, stats]) => ({
    name,
    ...stats,
    performance: stats.closed > 0 ? Math.round((stats.closed / (stats.open + stats.closed)) * 100) : 0,
  }));

  const topOffending = [...teamArray].sort((a, b) => b.overdue - a.overdue).slice(0, 5);
  const topPerforming = [...teamArray].sort((a, b) => b.performance - a.performance).slice(0, 5);

  const heatmapData = businessAreas.flatMap((area) =>
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => ({
      businessArea: area,
      severity: sev,
      count: findings.filter(
        (f) => (f.businessArea || 'Unknown') === area && f.severity === sev
      ).length,
    }))
  );

  res.json({
    bySeverity,
    byBusinessArea,
    byTechnology,
    monthlyTrend,
    ageingTrend: ageingBuckets,
    heatmap: heatmapData,
    topOffendingTeams: topOffending,
    topPerformingTeams: topPerforming,
  });
});

router.get('/board', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const [openCount, criticalCount, findings] = await Promise.all([
    prisma.finding.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.finding.count({ where: { severity: 'CRITICAL', status: { in: ACTIVE_STATUSES } } }),
    prisma.finding.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { recoveryScore: true, targetDate: true, status: true },
    }),
  ]);

  const avgRisk = findings.length
    ? Math.round(findings.reduce((s, f) => s + f.recoveryScore, 0) / findings.length)
    : 0;

  const overdue = findings.filter((f) => isOverdue(f.targetDate, f.status)).length;
  const slaCompliance = findings.length
    ? Math.round(((findings.length - overdue) / findings.length) * 100)
    : 100;

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    d.setDate(1);
    const end = new Date(d);
    end.setMonth(end.getMonth() + 1);
    const count = await prisma.finding.count({
      where: { createdAt: { lt: end }, OR: [{ closedAt: null }, { closedAt: { gte: end } }] },
    });
    trend.push({ month: d.toLocaleDateString('en-GB', { month: 'short' }), risk: count });
  }

  res.json({
    totalCyberRisk: avgRisk,
    criticalFindings: criticalCount,
    openFindings: openCount,
    slaCompliance,
    overdueFindings: overdue,
    riskTrend: trend,
    recoveryPerformance: slaCompliance,
  });
});

router.get('/analytics', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const categories = ['Cloud', 'Identity', 'Network', 'Applications', 'Servers'];
  const categoryMap: Record<string, string[]> = {
    Cloud: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker'],
    Identity: ['Active Directory', 'Entra ID', 'Okta', 'SailPoint'],
    Network: ['Firewall', 'Load Balancer', 'VPN', 'DNS'],
    Applications: ['Java', 'Node.js', '.NET', 'Python'],
    Servers: ['Windows Server', 'Linux', 'VMware', 'Hyper-V'],
  };

  const findings = await prisma.finding.findMany({
    select: { technology: true, severity: true, status: true, recoveryScore: true, businessArea: true },
  });

  const byCategory = categories.map((cat) => {
    const techs = categoryMap[cat];
    const matched = findings.filter((f) => techs.some((t) => f.technology?.includes(t)));
    return {
      category: cat,
      open: matched.filter((f) => ACTIVE_STATUSES.includes(f.status as FindingStatus)).length,
      total: matched.length,
      avgRisk: matched.length
        ? Math.round(matched.reduce((s, f) => s + f.recoveryScore, 0) / matched.length)
        : 0,
    };
  });

  const topRisks = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    orderBy: { recoveryScore: 'desc' },
    take: 10,
    select: {
      findingId: true,
      title: true,
      severity: true,
      recoveryScore: true,
      businessArea: true,
      technology: true,
    },
  });

  res.json({ byCategory, topRisks, totalFindings: findings.length });
});

router.get('/engineer-portal', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  if (!isAssignedOnlyRole(user.role) && user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'This dashboard is for assigned SMEs only' });
  }

  const userId = user.id;
  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const baseWhere = { ownerId: userId, status: { in: ACTIVE_STATUSES } };

  const [myFindings, overdue, dueThisWeek, blocked, critical, high, recentlyUpdated] = await Promise.all([
    prisma.finding.findMany({
      where: baseWhere,
      include: {
        application: { select: { name: true } },
        team: { select: { name: true } },
        service: { select: { id: true, name: true } },
        assignedBy: { select: { name: true } },
      },
      orderBy: { targetDate: 'asc' },
    }),
    prisma.finding.count({
      where: { ...baseWhere, targetDate: { lt: now } },
    }),
    prisma.finding.count({
      where: { ...baseWhere, targetDate: { gte: now, lte: weekEnd } },
    }),
    prisma.finding.count({
      where: { ownerId: userId, status: 'BLOCKED' },
    }),
    prisma.finding.count({
      where: { ...baseWhere, severity: 'CRITICAL' },
    }),
    prisma.finding.count({
      where: { ...baseWhere, severity: 'HIGH' },
    }),
    prisma.finding.findMany({
      where: { ownerId: userId, status: { in: ACTIVE_STATUSES }, updatedAt: { gte: weekAgo } },
      include: { service: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }),
  ]);

  const enrich = (f: typeof myFindings[0]) => ({
    ...f,
    daysRemaining: getDaysRemaining(f.targetDate),
    slaStatus: getDaysRemaining(f.targetDate) < 0 ? 'overdue'
      : getDaysRemaining(f.targetDate) <= 3 ? 'red'
      : getDaysRemaining(f.targetDate) <= 7 ? 'amber' : 'green',
  });

  res.json({
    myFindings: myFindings.map(enrich),
    overdue,
    dueThisWeek,
    blocked,
    critical,
    high,
    recentlyUpdated: recentlyUpdated.map(enrich),
    openCount: myFindings.length,
  });
});

router.get('/recovery', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const findings = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    select: { severity: true, targetDate: true, status: true, createdAt: true, closedAt: true },
  });

  const severityCounts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  let overdue = 0;
  let withinSla = 0;
  for (const f of findings) {
    severityCounts[f.severity as keyof typeof severityCounts]++;
    if (isOverdue(f.targetDate, f.status)) overdue++;
    else withinSla++;
  }

  const closed = await prisma.finding.findMany({
    where: { status: { in: CLOSED_STATUSES }, closedAt: { not: null } },
    select: { createdAt: true, closedAt: true },
  });
  const mttr = calcMttrDays(closed);

  res.json({
    totalOpen: findings.length,
    critical: severityCounts.CRITICAL,
    high: severityCounts.HIGH,
    medium: severityCounts.MEDIUM,
    low: severityCounts.LOW,
    overdue,
    slaCompliance: findings.length ? Math.round((withinSla / findings.length) * 100) : 100,
    mttr,
  });
});

router.get('/manager', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const where: { status: { in: string[] }; businessArea?: string; teamId?: string } = {
    status: { in: ACTIVE_STATUSES },
  };
  if (user.role === 'ENGINEERING_MANAGER' && user.department) {
    where.businessArea = user.department;
  } else if (user.role === 'TEAM_LEADER' && user.teamId) {
    where.teamId = user.teamId;
  }

  const findings = await prisma.finding.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      service: { select: { name: true } },
      team: { select: { name: true } },
    },
    orderBy: { targetDate: 'asc' },
    take: 100,
  });

  const overdue = findings.filter((f) => isOverdue(f.targetDate, f.status));
  const critical = findings.filter((f) => f.severity === 'CRITICAL');

  res.json({
    teamFindings: findings.map((f) => ({ ...f, daysRemaining: getDaysRemaining(f.targetDate) })),
    totalOpen: findings.length,
    overdue: overdue.length,
    critical: critical.length,
    topOverdue: overdue.slice(0, 10),
  });
});

router.get('/ciso', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const [openFindings, overdueFindings, teams] = await Promise.all([
    prisma.finding.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: {
        severity: true, recoveryScore: true, targetDate: true, status: true,
        businessArea: true, teamId: true, createdAt: true,
        service: { select: { name: true } },
        team: { select: { name: true } },
      },
    }),
    prisma.finding.findMany({
      where: { status: { in: ACTIVE_STATUSES }, targetDate: { lt: new Date() } },
      include: {
        owner: { select: { name: true } },
        service: { select: { name: true } },
        team: { select: { name: true } },
      },
      orderBy: { targetDate: 'asc' },
      take: 10,
    }),
    prisma.team.findMany({ select: { id: true, name: true } }),
  ]);

  const enterpriseRisk = openFindings.length
    ? Math.round(openFindings.reduce((s, f) => s + f.recoveryScore, 0) / openFindings.length)
    : 0;

  const teamPerformance: Record<string, { open: number; overdue: number; critical: number }> = {};
  for (const f of openFindings) {
    const team = f.team?.name || 'Unassigned';
    if (!teamPerformance[team]) teamPerformance[team] = { open: 0, overdue: 0, critical: 0 };
    teamPerformance[team].open++;
    if (isOverdue(f.targetDate, f.status)) teamPerformance[team].overdue++;
    if (f.severity === 'CRITICAL') teamPerformance[team].critical++;
  }

  const worstTeams = Object.entries(teamPerformance)
    .map(([name, stats]) => ({ name, ...stats, score: stats.overdue * 3 + stats.critical * 2 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i);
    start.setDate(1);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const [opened, closed] = await Promise.all([
      prisma.finding.count({ where: { createdAt: { gte: start, lt: end } } }),
      prisma.finding.count({ where: { closedAt: { gte: start, lt: end } } }),
    ]);
    monthlyTrend.push({ month: start.toLocaleDateString('en-GB', { month: 'short' }), opened, closed, net: opened - closed });
  }

  const heatmap = [...new Set(openFindings.map((f) => f.service?.name || 'Unknown'))].flatMap((svc) =>
    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => ({
      service: svc,
      severity: sev,
      count: openFindings.filter((f) => (f.service?.name || 'Unknown') === svc && f.severity === sev).length,
    }))
  );

  const thisMonth = new Date();
  thisMonth.setDate(1);
  const closedThisMonth = await prisma.finding.count({ where: { closedAt: { gte: thisMonth } } });

  res.json({
    enterpriseRisk,
    totalOpen: openFindings.length,
    criticalOpen: openFindings.filter((f) => f.severity === 'CRITICAL').length,
    topOverdue: overdueFindings.map((f) => ({ ...f, daysRemaining: getDaysRemaining(f.targetDate) })),
    worstTeams,
    monthlyTrend,
    heatmap,
    riskReduction: closedThisMonth,
  });
});

function startOfDay(d = new Date()): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function startOfWeek(d = new Date()): Date {
  const s = startOfDay(d);
  const day = s.getDay();
  const diff = day === 0 ? 6 : day - 1;
  s.setDate(s.getDate() - diff);
  return s;
}

router.get('/homepage', async (_req, res: Response) => {
  const now = new Date();
  const todayStart = startOfDay();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [openFindings, closedCount, criticalCount, overdueCount, dueToday, dueThisWeek, closedForMttr] =
    await Promise.all([
      prisma.finding.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        select: { targetDate: true, status: true },
      }),
      prisma.finding.count({ where: { status: { in: CLOSED_STATUSES } } }),
      prisma.finding.count({ where: { severity: 'CRITICAL', status: { in: ACTIVE_STATUSES } } }),
      prisma.finding.count({
        where: { status: { in: ACTIVE_STATUSES }, targetDate: { lt: now } },
      }),
      prisma.finding.count({
        where: {
          status: { in: ACTIVE_STATUSES },
          targetDate: { gte: todayStart, lt: new Date(todayStart.getTime() + 86400000) },
        },
      }),
      prisma.finding.count({
        where: { status: { in: ACTIVE_STATUSES }, targetDate: { gte: now, lte: weekEnd } },
      }),
      prisma.finding.findMany({
        where: { status: { in: CLOSED_STATUSES }, closedAt: { not: null } },
        select: { createdAt: true, closedAt: true },
      }),
    ]);

  const slaCompliance = openFindings.length
    ? Math.round(
        (openFindings.filter((f) => !isOverdue(f.targetDate, f.status)).length / openFindings.length) * 100
      )
    : 100;

  res.json({
    openVulnerabilities: openFindings.length,
    closedVulnerabilities: closedCount,
    criticalVulnerabilities: criticalCount,
    overdueVulnerabilities: overdueCount,
    tasksDueToday: dueToday,
    tasksDueThisWeek: dueThisWeek,
    slaCompliancePercent: slaCompliance,
    mttrDays: calcMttrDays(closedForMttr),
    updatedAt: new Date().toISOString(),
  });
});

router.get('/completed', authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = req.user!;
  const q = req.query as Record<string, string>;
  const page = parseInt(q.page || '1');
  const limit = parseInt(q.limit || '50');
  const skip = (page - 1) * limit;

  const where: {
    status: { in: string[] };
    serviceId?: string;
    ownerId?: string;
    severity?: string;
    closedAt?: { gte?: Date; lte?: Date };
  } = { status: { in: CLOSED_STATUSES } };

  if (isAssignedOnlyRole(user.role)) {
    where.ownerId = user.id;
  } else if (q.ownerId) {
    where.ownerId = q.ownerId;
  }
  if (q.serviceId) where.serviceId = q.serviceId;
  if (q.severity) where.severity = q.severity;
  if (q.from || q.to) {
    where.closedAt = {};
    if (q.from) where.closedAt.gte = new Date(q.from);
    if (q.to) {
      const to = new Date(q.to);
      to.setHours(23, 59, 59, 999);
      where.closedAt.lte = to;
    }
  }

  const todayStart = startOfDay();
  const weekStart = startOfWeek();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const statsWhere = { ...where };

  const [total, completedToday, completedThisWeek, completedThisMonth, findings, totalCount, smeUsers] =
    await Promise.all([
      prisma.finding.count({ where: statsWhere }),
      prisma.finding.count({ where: { ...statsWhere, closedAt: { gte: todayStart } } }),
      prisma.finding.count({ where: { ...statsWhere, closedAt: { gte: weekStart } } }),
      prisma.finding.count({ where: { ...statsWhere, closedAt: { gte: monthStart } } }),
      prisma.finding.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { closedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.finding.count({ where }),
      prisma.user.findMany({
        where: { role: 'SME' },
        select: { id: true, name: true },
      }),
    ]);

  const allClosed = await prisma.finding.findMany({
    where: statsWhere,
    select: { createdAt: true, closedAt: true, ownerId: true },
  });

  const avgRemediationDays = calcMttrDays(allClosed);

  const bySme = smeUsers.map((sme) => {
    const mine = allClosed.filter((f) => f.ownerId === sme.id);
    const monthMine = mine.filter((f) => f.closedAt && f.closedAt >= monthStart);
    return {
      id: sme.id,
      name: sme.name,
      totalCompleted: mine.length,
      completedThisMonth: monthMine.length,
      avgRemediationDays: calcMttrDays(mine),
    };
  });

  res.json({
    stats: {
      total,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      avgRemediationDays,
    },
    bySme,
    findings: findings.map((f) => ({
      ...f,
      remediationDays: f.closedAt
        ? Math.round((f.closedAt.getTime() - f.createdAt.getTime()) / 86400000)
        : null,
    })),
    pagination: { page, limit, total: totalCount, pages: Math.ceil(totalCount / limit) },
    updatedAt: new Date().toISOString(),
  });
});

router.get('/analytics-enhanced', authMiddleware, async (_req: AuthRequest, res: Response) => {
  const [openFindings, allFindings, smeUsers, services] = await Promise.all([
    prisma.finding.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: {
        severity: true,
        targetDate: true,
        status: true,
        ownerId: true,
        serviceId: true,
        service: { select: { name: true } },
      },
    }),
    prisma.finding.findMany({
      select: { createdAt: true, closedAt: true, status: true, serviceId: true, service: { select: { name: true } } },
    }),
    prisma.user.findMany({ where: { role: 'SME' }, select: { id: true, name: true } }),
    prisma.service.findMany({ select: { id: true, name: true } }),
  ]);

  const openVsClosedTrend = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const opened = allFindings.filter((f) => f.createdAt >= start && f.createdAt < end).length;
    const closed = allFindings.filter(
      (f) => f.closedAt && f.closedAt >= start && f.closedAt < end && CLOSED_STATUSES.includes(f.status as FindingStatus)
    ).length;

    const openAtEnd = allFindings.filter((f) => {
      if (f.createdAt >= end) return false;
      if (!f.closedAt) return !CLOSED_STATUSES.includes(f.status as FindingStatus);
      return f.closedAt >= end;
    }).length;

    openVsClosedTrend.push({
      month: start.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      open: openAtEnd,
      closed,
      opened,
      net: opened - closed,
    });
  }

  const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => ({
    name: s,
    value: openFindings.filter((f) => f.severity === s).length,
  }));

  const tasksBySme = smeUsers.map((sme) => ({
    name: sme.name.split(' ')[0],
    fullName: sme.name,
    open: openFindings.filter((f) => f.ownerId === sme.id).length,
  }));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const closedFindings = await prisma.finding.findMany({
    where: { status: { in: CLOSED_STATUSES }, closedAt: { not: null } },
    select: { createdAt: true, closedAt: true, ownerId: true },
  });

  const completedBySme = smeUsers
    .map((sme) => {
      const mine = closedFindings.filter((f) => f.ownerId === sme.id);
      const monthMine = mine.filter((f) => f.closedAt! >= monthStart);
      return {
        name: sme.name,
        totalCompleted: mine.length,
        completedThisMonth: monthMine.length,
        avgRemediationDays: calcMttrDays(mine),
      };
    })
    .sort((a, b) => b.totalCompleted - a.totalCompleted);

  let withinSla = 0;
  let dueSoon = 0;
  let overdue = 0;
  for (const f of openFindings) {
    const bucket = getSlaBucket(f.targetDate, f.status);
    if (bucket === 'within') withinSla++;
    else if (bucket === 'dueSoon') dueSoon++;
    else overdue++;
  }
  const openTotal = openFindings.length || 1;
  const slaPerformance = {
    withinSla,
    dueSoon,
    overdue,
    withinSlaPercent: Math.round((withinSla / openTotal) * 100),
    dueSoonPercent: Math.round((dueSoon / openTotal) * 100),
    overduePercent: Math.round((overdue / openTotal) * 100),
  };

  const slaTrend = [];
  for (let i = 5; i >= 0; i--) {
    const end = new Date();
    end.setMonth(end.getMonth() - i + 1);
    end.setDate(1);
    const start = new Date(end);
    start.setMonth(start.getMonth() - 1);

    const openAtMonth = allFindings.filter((f) => {
      if (f.createdAt >= end) return false;
      if (!f.closedAt) return f.createdAt < end && !CLOSED_STATUSES.includes(f.status as FindingStatus);
      return f.createdAt < end && f.closedAt >= start;
    });

    const monthOverdue = openAtMonth.filter((f) => {
      const target = new Date(f.createdAt);
      target.setDate(target.getDate() + 30);
      return target < end;
    }).length;

    const compliance = openAtMonth.length
      ? Math.round(((openAtMonth.length - monthOverdue) / openAtMonth.length) * 100)
      : 100;

    slaTrend.push({
      month: start.toLocaleDateString('en-GB', { month: 'short' }),
      compliance,
      overdue: monthOverdue,
    });
  }

  const monthlyRecoveryTrend = openVsClosedTrend.map((m) => ({
    month: m.month,
    opened: m.opened,
    closed: m.closed,
    netReduction: m.net,
    outstanding: m.open,
  }));

  const serviceRisk = services.map((svc) => {
    const svcOpen = openFindings.filter((f) => f.serviceId === svc.id);
    const svcAll = allFindings.filter((f) => f.serviceId === svc.id);
    const svcClosed = svcAll.filter((f) => CLOSED_STATUSES.includes(f.status as FindingStatus)).length;
    const svcCritical = svcOpen.filter((f) => f.severity === 'CRITICAL').length;
    const svcOverdue = svcOpen.filter((f) => isOverdue(f.targetDate, f.status)).length;
    const completionPercent = svcAll.length ? Math.round((svcClosed / svcAll.length) * 100) : 0;
    return {
      name: svc.name,
      total: svcAll.length,
      open: svcOpen.length,
      critical: svcCritical,
      overdue: svcOverdue,
      completionPercent,
    };
  }).sort((a, b) => b.open - a.open);

  res.json({
    openVsClosedTrend,
    bySeverity,
    tasksBySme,
    completedBySme,
    slaPerformance,
    slaTrend,
    monthlyRecoveryTrend,
    serviceRisk,
    totalOpen: openFindings.length,
    totalClosed: closedFindings.length,
    updatedAt: new Date().toISOString(),
  });
});

export default router;
