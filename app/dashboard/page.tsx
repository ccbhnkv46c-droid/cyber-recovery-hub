'use client';

import { useCallback, useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { MetricCard, PageHeader, LoadingSpinner } from '@/components/ui';
import {
  SeverityChart, BarChartWidget, TrendChart, HeatmapGrid, TeamPerformanceChart,
  OpenClosedChart, SlaPerformanceChart, SlaTrendChart, SmeWorkloadChart,
  LeaderboardChart, RecoveryTrendChart, ServiceRiskTable,
} from '@/components/charts';
import { apiFetch, useAuthStore } from '@/lib/store';
import { usePolling } from '@/lib/hooks/usePolling';
import { BRAND } from '@/lib/branding';
import { Logo } from '@/components/branding/Logo';
import {
  AlertTriangle, Shield, Clock, TrendingDown, CheckCircle, Target, Timer, Activity,
  HardDrive, Globe, Server, Radar, ShieldAlert,
} from 'lucide-react';

interface DashboardData {
  cards: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    overdue: number;
    withinSlaPercent: number;
    mttr: number;
    riskReductionThisMonth: number;
    totalOpen: number;
  };
}

interface ChartData {
  bySeverity: { name: string; value: number }[];
  byBusinessArea: { name: string; value: number }[];
  byTechnology: { name: string; value: number }[];
  monthlyTrend: { month: string; opened: number; closed: number }[];
  ageingTrend: { name: string; value: number }[];
  heatmap: { businessArea: string; severity: string; count: number }[];
  topOffendingTeams: { name: string; overdue: number; performance: number }[];
  topPerformingTeams: { name: string; performance: number }[];
}

interface AssetExposure {
  criticalAssetsWithOpenVulns: number;
  internetFacingAssetsWithOpenVulns: number;
  servicesWithHighestExposure: { name: string; open: number; critical: number }[];
  assetsWithOverdueRemediation: number;
}

interface ThreatIntelMetrics {
  vulnerabilitiesWithActiveExploitation: number;
  publicExploitAvailable: number;
  ransomwareLinkedVulnerabilities: number;
  criticalServicesAffectedByActiveThreats: number;
  internetFacingAssetsWithActiveThreatIntel: number;
}

interface EnhancedAnalytics {
  openVsClosedTrend: { month: string; open: number; closed: number }[];
  bySeverity: { name: string; value: number }[];
  tasksBySme: { name: string; open: number }[];
  completedBySme: { name: string; totalCompleted: number; completedThisMonth: number; avgRemediationDays: number }[];
  slaPerformance: { withinSla: number; dueSoon: number; overdue: number; withinSlaPercent: number; dueSoonPercent: number; overduePercent: number };
  slaTrend: { month: string; compliance: number }[];
  monthlyRecoveryTrend: { month: string; opened: number; closed: number; netReduction: number }[];
  serviceRisk: { name: string; total: number; critical: number; overdue: number; completionPercent: number }[];
  totalOpen: number;
  totalClosed: number;
  updatedAt: string;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [cards, setCards] = useState<DashboardData['cards'] | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [enhanced, setEnhanced] = useState<EnhancedAnalytics | null>(null);
  const [assetExposure, setAssetExposure] = useState<AssetExposure | null>(null);
  const [threatMetrics, setThreatMetrics] = useState<ThreatIntelMetrics | null>(null);
  const [cisoData, setCisoData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const isCiso = user?.role === 'CISO';
  const isManager = user?.role === 'ENGINEERING_MANAGER' || user?.role === 'TEAM_LEADER';

  const loadData = useCallback(async () => {
    const requests: Promise<unknown>[] = [
      apiFetch<DashboardData>('/dashboard/executive'),
      apiFetch<ChartData>('/dashboard/charts'),
      apiFetch<EnhancedAnalytics>('/dashboard/analytics-enhanced'),
      apiFetch<AssetExposure>('/dashboard/asset-exposure'),
      apiFetch<ThreatIntelMetrics>('/dashboard/threat-intelligence'),
    ];
    if (isCiso) requests.push(apiFetch('/dashboard/ciso'));
    if (isManager) requests.push(apiFetch('/dashboard/manager'));

    try {
      const results = await Promise.all(requests);
      const exec = results[0] as DashboardData;
      setCards(exec.cards);
      setCharts(results[1] as ChartData);
      const enhancedResult = results[2] as EnhancedAnalytics;
      setEnhanced(enhancedResult);
      setAssetExposure(results[3] as AssetExposure);
      setThreatMetrics(results[4] as ThreatIntelMetrics);
      setLastUpdated(new Date(enhancedResult.updatedAt).toLocaleTimeString());
      if (isCiso && results[5]) setCisoData(results[5] as Record<string, unknown>);
      if (isManager) setCisoData((results[isCiso ? 6 : 5] as Record<string, unknown>) || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isCiso, isManager]);

  useEffect(() => { loadData(); }, [loadData]);
  usePolling(loadData, 15000, !loading);

  if (loading && !cards) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const slaChartData = enhanced ? [
    { name: 'Within SLA', value: enhanced.slaPerformance.withinSla, fill: '#16a34a' },
    { name: 'Due Soon', value: enhanced.slaPerformance.dueSoon, fill: '#ca8a04' },
    { name: 'Overdue', value: enhanced.slaPerformance.overdue, fill: '#dc2626' },
  ] : [];

  return (
    <ProtectedLayout>
      {!isCiso && !isManager && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-br from-brand-600/10 via-surface-900/5 to-brand-500/5 p-8 dark:from-brand-600/20 dark:via-surface-900/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <Logo size={56} className="mb-4" priority />
              <h1 className="font-display text-3xl font-bold text-surface-900 dark:text-white sm:text-4xl">
                {BRAND.shortName}
              </h1>
              <p className="mt-2 text-lg font-medium text-brand-600 dark:text-brand-400">
                {BRAND.tagline}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-surface-600 dark:text-surface-400">
                {BRAND.heroDescription}
              </p>
            </div>
          </div>
        </section>
      )}

      <PageHeader
        title={isCiso ? 'CISO Dashboard' : isManager ? 'Manager Dashboard' : 'Recover Dashboard'}
        description={isCiso
          ? 'Enterprise risk posture, overdue exposure, and organisational performance'
          : isManager
            ? 'Your team\'s vulnerability remediation status and SLA compliance'
            : 'Real-time recover metrics and organisational performance'}
        actions={
          lastUpdated && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live · Updated {lastUpdated}
            </span>
          )
        }
      />

      {isCiso && cisoData && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title="Enterprise Risk Score" value={cisoData.enterpriseRisk as number} icon={Shield} color="red" />
          <MetricCard title="Critical Open" value={cisoData.criticalOpen as number} icon={AlertTriangle} color="red" />
          <MetricCard title="Risk Reduction" value={cisoData.riskReduction as number} icon={TrendingDown} color="green" subtitle="Closed this month" />
          <MetricCard title="Total Open" value={cisoData.totalOpen as number} icon={Activity} color="brand" />
        </div>
      )}

      {isManager && cisoData && (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <MetricCard title="Team Open" value={(cisoData as { totalOpen: number }).totalOpen} icon={Activity} />
          <MetricCard title="Team Overdue" value={(cisoData as { overdue: number }).overdue} icon={Clock} color="red" />
          <MetricCard title="Team Critical" value={(cisoData as { critical: number }).critical} icon={AlertTriangle} color="orange" />
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Open Vulnerabilities" value={enhanced?.totalOpen || cards?.totalOpen || 0} icon={Activity} color="brand" />
        <MetricCard title="Closed Vulnerabilities" value={enhanced?.totalClosed || 0} icon={CheckCircle} color="green" />
        <MetricCard title="Critical Findings" value={cards?.critical || 0} icon={AlertTriangle} color="red" />
        <MetricCard title="Overdue Findings" value={cards?.overdue || 0} icon={Clock} color="red" subtitle="Requires immediate action" />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="High Findings" value={cards?.high || 0} icon={Shield} color="orange" />
        <MetricCard title="Within SLA" value={`${enhanced?.slaPerformance.withinSlaPercent || cards?.withinSlaPercent || 0}%`} icon={Target} color="green" />
        <MetricCard title="Mean Time To Remediate" value={`${cards?.mttr || 0}d`} icon={Timer} color="brand" />
        <MetricCard title="Risk Reduction" value={cards?.riskReductionThisMonth || 0} icon={TrendingDown} color="brand" subtitle="Closed this month" />
      </div>

      {assetExposure && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Critical Assets (Open Vulns)"
            value={assetExposure.criticalAssetsWithOpenVulns}
            icon={HardDrive}
            color="red"
            subtitle="Business-critical exposure"
          />
          <MetricCard
            title="Internet-Facing Assets"
            value={assetExposure.internetFacingAssetsWithOpenVulns}
            icon={Globe}
            color="orange"
            subtitle="Externally exposed assets"
          />
          <MetricCard
            title="Assets Overdue"
            value={assetExposure.assetsWithOverdueRemediation}
            icon={Clock}
            color="red"
            subtitle="Past remediation SLA"
          />
          <MetricCard
            title="Top Service Exposure"
            value={assetExposure.servicesWithHighestExposure[0]?.name || '—'}
            icon={Server}
            color="brand"
            subtitle={assetExposure.servicesWithHighestExposure[0]
              ? `${assetExposure.servicesWithHighestExposure[0].open} open vulnerabilities`
              : 'No exposed services'}
          />
        </div>
      )}

      {threatMetrics && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Active Exploitation"
            value={threatMetrics.vulnerabilitiesWithActiveExploitation}
            icon={ShieldAlert}
            color="red"
            subtitle="Open vulns with active threat intel"
          />
          <MetricCard
            title="Public Exploit Available"
            value={threatMetrics.publicExploitAvailable}
            icon={Radar}
            color="orange"
            subtitle="Exploit code in the wild"
          />
          <MetricCard
            title="Ransomware Linked"
            value={threatMetrics.ransomwareLinkedVulnerabilities}
            icon={ShieldAlert}
            color="purple"
            subtitle="CVEs tied to ransomware"
          />
          <MetricCard
            title="Critical Services at Risk"
            value={threatMetrics.criticalServicesAffectedByActiveThreats}
            icon={Server}
            color="red"
            subtitle="Active threats on critical services"
          />
          <MetricCard
            title="Internet-Facing + Active Threat"
            value={threatMetrics.internetFacingAssetsWithActiveThreatIntel}
            icon={Globe}
            color="orange"
            subtitle="Externally exposed with active intel"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Open vs Closed Vulnerabilities</h3>
          {enhanced && <OpenClosedChart data={enhanced.openVsClosedTrend} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Vulnerabilities by Severity</h3>
          {enhanced && <SeverityChart data={enhanced.bySeverity} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Tasks by SME</h3>
          {enhanced && <SmeWorkloadChart data={enhanced.tasksBySme} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Completed Tasks by SME</h3>
          {enhanced && (
            <LeaderboardChart
              data={enhanced.completedBySme.map((s) => ({
                name: s.name.split(' ')[0],
                totalCompleted: s.totalCompleted,
                completedThisMonth: s.completedThisMonth,
              }))}
            />
          )}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">SLA Performance</h3>
          {enhanced && (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <p className="font-bold text-green-500">{enhanced.slaPerformance.withinSlaPercent}%</p>
                  <p className="text-surface-500">Within SLA</p>
                </div>
                <div className="rounded-lg bg-yellow-500/10 p-2">
                  <p className="font-bold text-yellow-500">{enhanced.slaPerformance.dueSoonPercent}%</p>
                  <p className="text-surface-500">Due Soon</p>
                </div>
                <div className="rounded-lg bg-red-500/10 p-2">
                  <p className="font-bold text-red-500">{enhanced.slaPerformance.overduePercent}%</p>
                  <p className="text-surface-500">Overdue</p>
                </div>
              </div>
              <SlaPerformanceChart data={slaChartData} />
            </>
          )}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">SLA Compliance Trend</h3>
          {enhanced && <SlaTrendChart data={enhanced.slaTrend} />}
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-semibold">Monthly Recover Trend</h3>
          {enhanced && <RecoveryTrendChart data={enhanced.monthlyRecoveryTrend} />}
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-semibold">Service Risk Dashboard</h3>
          {enhanced && <ServiceRiskTable data={enhanced.serviceRisk} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Open Findings by Business Area</h3>
          {charts && <BarChartWidget data={charts.byBusinessArea.slice(0, 8)} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Ageing Trend</h3>
          {charts && <BarChartWidget data={charts.ageingTrend} color="#8b5cf6" />}
        </div>
        <div className="card lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-semibold">Risk Heat Map</h3>
          {charts && <HeatmapGrid data={charts.heatmap} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">
            {isCiso ? 'Worst Performing Teams' : 'Top Offending Teams'}
          </h3>
          {charts && <TeamPerformanceChart data={charts.topOffendingTeams} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Open by Technology</h3>
          {charts && <BarChartWidget data={charts.byTechnology} color="#059669" />}
        </div>
      </div>
    </ProtectedLayout>
  );
}
