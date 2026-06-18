'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, RiskRatingBadge, ThreatPriorityBadge } from '@/components/ui';
import { apiFetch, useAuthStore } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';
import { Download, Filter, Gauge } from 'lucide-react';
import { RISK_RATINGS } from '@/lib/risk-scoring';

interface RiskFinding {
  id: string;
  findingId: string;
  title: string;
  severity: string;
  cvssScore: number;
  exposureRiskScore: number;
  exposureRiskRating: string;
  exposureRiskReason: string;
  threatPriority: string | null;
  exposureLevel: string | null;
  isOverdue: boolean;
  status: string;
  targetDate: string;
  owner: { name: string } | null;
  service: { id: string; name: string } | null;
  assetRecord: {
    id: string;
    name: string;
    businessCriticality: string;
    internetFacing: boolean;
    criticalService: boolean;
  } | null;
  hasThreatMatch?: boolean;
}

interface PrioritisationData {
  top10: RiskFinding[];
  highestRiskServices: { id: string; name: string; maxScore: number; avgScore: number; count: number }[];
  highestRiskAssets: { id: string; name: string; maxScore: number; avgScore: number; count: number }[];
  highRiskOverdue: RiskFinding[];
  internetFacingHighRisk: RiskFinding[];
  threatIntelDriven: RiskFinding[];
  ransomwareLinked: RiskFinding[];
  criticalServiceRisks: RiskFinding[];
  total: number;
  canExport: boolean;
  filterMeta: {
    services: { id: string; name: string }[];
    assets: { id: string; name: string }[];
    owners: { id: string; name: string }[];
  };
}

function FindingRow({ f }: { f: RiskFinding }) {
  return (
    <tr className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
      <td className="px-4 py-3">
        <Link href={`/findings/${f.findingId}`} className="font-mono text-xs text-brand-600 hover:underline">
          {f.findingId}
        </Link>
      </td>
      <td className="max-w-[180px] truncate px-4 py-3 text-sm">{f.title}</td>
      <td className="px-4 py-3"><RiskRatingBadge rating={f.exposureRiskRating} score={f.exposureRiskScore} /></td>
      <td className="px-4 py-3 text-xs">{f.service?.name || '—'}</td>
      <td className="px-4 py-3 text-xs">{f.assetRecord?.name || '—'}</td>
      <td className="px-4 py-3"><ThreatPriorityBadge priority={f.threatPriority} /></td>
      <td className="px-4 py-3 text-xs">{f.owner?.name || '—'}</td>
      <td className={cn('px-4 py-3 text-xs', f.isOverdue && 'font-medium text-red-500')}>
        {f.isOverdue ? 'Overdue' : formatDate(f.targetDate)}
      </td>
    </tr>
  );
}

function SectionTable({ title, findings, description }: { title: string; findings: RiskFinding[]; description?: string }) {
  if (!findings.length) return null;
  return (
    <div className="card mb-6">
      <h3 className="mb-1 font-display text-lg font-semibold">{title}</h3>
      {description && <p className="mb-4 text-sm text-surface-500">{description}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 dark:border-surface-800">
              {['ID', 'Title', 'Risk', 'Service', 'Asset', 'Threat', 'Owner', 'Due'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
            {findings.map((f) => <FindingRow key={f.id} f={f} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RiskPrioritisationPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<PrioritisationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filterState).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const result = await apiFetch<PrioritisationData>(`/risk/prioritisation?${params}`);
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filterState]);

  useEffect(() => { load(); }, [load]);

  const exportQueue = async () => {
    const params = new URLSearchParams(filterState);
    const token = localStorage.getItem('crh-token');
    const res = await fetch(`/api/risk/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-prioritisation-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isSme = user?.role === 'SME' || user?.role === 'ENGINEER';

  return (
    <ProtectedLayout>
      <PageHeader
        title="Risk Prioritisation"
        description={isSme
          ? 'Exposure-weighted risk queue for your assigned findings'
          : 'Risk-based exposure management — prioritise remediation by business impact'}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
              <Filter className="h-4 w-4" /> Filters
            </button>
            {data?.canExport && (
              <button onClick={exportQueue} className="btn-primary">
                <Download className="h-4 w-4" /> Export Queue
              </button>
            )}
          </div>
        }
      />

      {showFilters && (
        <div className="card mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <select className="input" value={filterState.riskRating || ''} onChange={(e) => setFilterState({ ...filterState, riskRating: e.target.value })}>
            <option value="">All Risk Ratings</option>
            {RISK_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {!isSme && data?.filterMeta.services && (
            <select className="input" value={filterState.serviceId || ''} onChange={(e) => setFilterState({ ...filterState, serviceId: e.target.value })}>
              <option value="">All Services</option>
              {data.filterMeta.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {!isSme && data?.filterMeta.assets && (
            <select className="input" value={filterState.assetId || ''} onChange={(e) => setFilterState({ ...filterState, assetId: e.target.value })}>
              <option value="">All Assets</option>
              {data.filterMeta.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {!isSme && data?.filterMeta.owners && (
            <select className="input" value={filterState.ownerId || ''} onChange={(e) => setFilterState({ ...filterState, ownerId: e.target.value })}>
              <option value="">All SMEs</option>
              {data.filterMeta.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <select className="input" value={filterState.businessCriticality || ''} onChange={(e) => setFilterState({ ...filterState, businessCriticality: e.target.value })}>
            <option value="">All Criticality</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={filterState.internetFacing || ''} onChange={(e) => setFilterState({ ...filterState, internetFacing: e.target.value })}>
            <option value="">Internet Facing</option>
            <option value="true">Internet Facing Only</option>
          </select>
          <select className="input" value={filterState.activeExploitation || ''} onChange={(e) => setFilterState({ ...filterState, activeExploitation: e.target.value })}>
            <option value="">Active Exploitation</option>
            <option value="true">Actively Exploited</option>
          </select>
          <select className="input" value={filterState.overdue || ''} onChange={(e) => setFilterState({ ...filterState, overdue: e.target.value })}>
            <option value="">Overdue</option>
            <option value="true">Overdue Only</option>
          </select>
          <select className="input" value={filterState.ransomware || ''} onChange={(e) => setFilterState({ ...filterState, ransomware: e.target.value })}>
            <option value="">Ransomware</option>
            <option value="true">Ransomware Linked</option>
          </select>
          <select className="input" value={filterState.criticalService || ''} onChange={(e) => setFilterState({ ...filterState, criticalService: e.target.value })}>
            <option value="">Critical Service</option>
            <option value="true">Critical Service Only</option>
          </select>
          <button onClick={() => setFilterState({})} className="btn-ghost">Clear</button>
        </div>
      )}

      {loading && !data ? (
        <LoadingSpinner />
      ) : data ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card flex items-center gap-3">
              <Gauge className="h-8 w-8 text-brand-500" />
              <div>
                <p className="text-sm text-surface-500">Open Risks in Queue</p>
                <p className="font-display text-2xl font-bold">{data.total}</p>
              </div>
            </div>
            <div className="card">
              <p className="text-sm text-surface-500">Top Risk Score</p>
              <p className="font-display text-2xl font-bold text-red-500">{data.top10[0]?.exposureRiskScore ?? '—'}</p>
              <p className="text-xs text-surface-500">{data.top10[0]?.findingId}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-500">Highest-Risk Service</p>
              <p className="font-display text-lg font-bold">{data.highestRiskServices[0]?.name || '—'}</p>
              <p className="text-xs text-surface-500">Max score {data.highestRiskServices[0]?.maxScore ?? '—'}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-500">Highest-Risk Asset</p>
              <p className="font-display text-lg font-bold">{data.highestRiskAssets[0]?.name || '—'}</p>
              <p className="text-xs text-surface-500">Max score {data.highestRiskAssets[0]?.maxScore ?? '—'}</p>
            </div>
          </div>

          <SectionTable
            title="Top 10 Highest-Risk Findings"
            findings={data.top10}
            description="Sorted by exposure risk score — combines CVSS, asset context, threat intelligence, and operational factors."
          />

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card">
              <h3 className="mb-4 font-semibold">Highest-Risk Services</h3>
              <ul className="space-y-2 text-sm">
                {data.highestRiskServices.map((s) => (
                  <li key={s.id} className="flex justify-between border-b border-surface-200 py-2 dark:border-surface-800">
                    <span>{s.name}</span>
                    <span className="font-mono text-red-500">{s.maxScore} <span className="text-surface-500">({s.count} findings)</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h3 className="mb-4 font-semibold">Highest-Risk Assets</h3>
              <ul className="space-y-2 text-sm">
                {data.highestRiskAssets.map((a) => (
                  <li key={a.id} className="flex justify-between border-b border-surface-200 py-2 dark:border-surface-800">
                    <span>{a.name}</span>
                    <span className="font-mono text-red-500">{a.maxScore} <span className="text-surface-500">({a.count} findings)</span></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <SectionTable title="High-Risk Overdue Findings" findings={data.highRiskOverdue} />
          <SectionTable title="Internet-Facing High-Risk Exposures" findings={data.internetFacingHighRisk} />
          <SectionTable title="Threat-Intelligence-Driven Risks" findings={data.threatIntelDriven} />
          <SectionTable title="Ransomware-Linked Risks" findings={data.ransomwareLinked} />
          <SectionTable title="Critical Service Risks" findings={data.criticalServiceRisks} />
        </>
      ) : null}
    </ProtectedLayout>
  );
}
