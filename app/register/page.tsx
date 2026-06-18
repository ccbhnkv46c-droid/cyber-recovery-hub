'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, SeverityBadge, StatusBadge, ThreatPriorityBadge, ThreatIntelBadge, RiskRatingBadge } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { cn, formatDate, slaStatusColor, escalationLabel } from '@/lib/utils';
import { Search, Download, Filter, ChevronLeft, ChevronRight, FileText, UserPlus, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportFindingsPDF } from '@/lib/export';
import { toast } from '@/lib/toast';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/lib/store';
import { EXPOSURE_LABELS } from '@/lib/assets';
import { RISK_RATINGS } from '@/lib/risk-scoring';
import { canAssignWork } from '@/lib/rbac';

interface Finding {
  id: string;
  findingId: string;
  title: string;
  severity: string;
  cvssScore: number;
  businessService: string;
  application: { name: string } | null;
  service: { id: string; name: string } | null;
  assetRecord: { id: string; name: string; businessCriticality: string; environment: string; internetFacing: boolean } | null;
  technology: string;
  asset: string;
  owner: { name: string } | null;
  team: { name: string } | null;
  manager: { name: string } | null;
  businessOwner: { name: string } | null;
  status: string;
  createdAt: string;
  targetDate: string;
  daysRemaining: number;
  slaStatus: string;
  escalationLevel: string;
  nextAction: string;
  evidenceCount: number;
  riskAccepted: boolean;
  exceptionExpiry: string | null;
  cve: string | null;
  hasThreatMatch?: boolean;
  threatPriority?: string | null;
  exposureRiskScore?: number;
  exposureRiskRating?: string;
  exposureRiskReason?: string;
  exposureLevel?: string | null;
}

interface Filters {
  businessAreas: string[];
  technologies: string[];
  applications: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  services: { id: string; name: string; businessArea: string | null }[];
  managers: { id: string; name: string }[];
  assets: { id: string; name: string; serviceId: string; businessCriticality: string }[];
}

export default function RegisterPage() {
  const { user } = useAuthStore();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOwner, setAssignOwner] = useState('');
  const [assigning, setAssigning] = useState(false);

  const loadFindings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search) params.set('search', search);
    Object.entries(filterState).forEach(([k, v]) => { if (v) params.set(k, v); });

    try {
      const data = await apiFetch<{ findings: Finding[]; pagination: { pages: number } }>(
        `/findings?${params}`
      );
      setFindings(data.findings);
      setTotalPages(data.pagination.pages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search, filterState]);

  useEffect(() => { loadFindings(); }, [loadFindings]);
  useEffect(() => {
    apiFetch<Filters>('/admin/filters').then(setFilters).catch(console.error);
  }, []);

  const exportExcel = () => {
    const rows = findings.map((f) => ({
      'Finding ID': f.findingId,
      Title: f.title,
      Severity: f.severity,
      'CVSS Score': f.cvssScore,
      'Business Service': f.businessService,
      Application: f.application?.name,
      Asset: f.assetRecord?.name || f.asset,
      Owner: f.owner?.name,
      Team: f.team?.name,
      Manager: f.manager?.name,
      'Business Owner': f.businessOwner?.name,
      Status: f.status,
      'Created Date': formatDate(f.createdAt),
      'Target Date': formatDate(f.targetDate),
      'Days Remaining': f.daysRemaining,
      'Escalation Level': escalationLabel(f.escalationLevel),
      'Next Action': f.nextAction,
      'Risk Score': f.exposureRiskScore,
      'Risk Rating': f.exposureRiskRating,
      'Risk Reason': f.exposureRiskReason,
      'Threat Priority': f.threatPriority,
      'Asset Criticality': f.assetRecord?.businessCriticality,
      'Exposure Level': f.exposureLevel,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Findings');
    XLSX.writeFile(wb, `vulnerability-register-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast('Excel export complete', 'success');
  };

  const exportPdf = () => {
    exportFindingsPDF(findings);
    toast('PDF export complete', 'success');
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === findings.length) setSelected(new Set());
    else setSelected(new Set(findings.map((f) => f.id)));
  };

  const bulkAssign = async () => {
    if (!assignOwner || selected.size === 0) return toast('Select vulnerabilities and an SME', 'error');
    setAssigning(true);
    try {
      const res = await apiFetch<{ assigned: number; owner: { name: string } }>('/bulk/assign', {
        method: 'POST',
        body: JSON.stringify({ findingIds: [...selected], ownerId: assignOwner }),
      });
      toast(`Assigned ${res.assigned} vulnerabilities to ${res.owner.name}`, 'success');
      setSelected(new Set());
      loadFindings();
    } catch {
      toast('Bulk assignment failed', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const canAssign = canAssignWork(user?.role || '');

  return (
    <ProtectedLayout>
      <PageHeader
        title="Vulnerability Register"
        description={user?.role === 'ADMIN'
          ? 'Full register — select and bulk-assign vulnerabilities to SMEs'
          : 'Search, filter and manage recover findings'}
        actions={
          <>
            <button onClick={exportExcel} className="btn-secondary">
              <Download className="h-4 w-4" /> Excel
            </button>
            <button onClick={exportPdf} className="btn-secondary">
              <FileText className="h-4 w-4" /> PDF
            </button>
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            className="input pl-10"
            placeholder="Search by ID, title, asset..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary">
          <Filter className="h-4 w-4" /> Filters
        </button>
      </div>

      {showFilters && filters && (
        <div className="card mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <select className="input" value={filterState.severity || ''} onChange={(e) => setFilterState({ ...filterState, severity: e.target.value })}>
            <option value="">All Severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={filterState.status || ''} onChange={(e) => setFilterState({ ...filterState, status: e.target.value })}>
            <option value="">All Statuses</option>
            {['OPEN', 'IN_PROGRESS', 'AWAITING_CHANGE', 'BLOCKED', 'AWAITING_APPROVAL', 'RISK_ACCEPTED', 'COMPLETED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input" value={filterState.serviceId || ''} onChange={(e) => setFilterState({ ...filterState, serviceId: e.target.value })}>
            <option value="">All Services</option>
            {filters.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input" value={filterState.assetId || ''} onChange={(e) => setFilterState({ ...filterState, assetId: e.target.value })}>
            <option value="">All Assets</option>
            {filters.assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" value={filterState.applicationId || ''} onChange={(e) => setFilterState({ ...filterState, applicationId: e.target.value })}>
            <option value="">All Applications</option>
            {filters.applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" value={filterState.ownerId || ''} onChange={(e) => setFilterState({ ...filterState, ownerId: e.target.value })}>
            <option value="">All SMEs</option>
            {filters.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select className="input" value={filterState.businessArea || ''} onChange={(e) => setFilterState({ ...filterState, businessArea: e.target.value })}>
            <option value="">All Business Areas</option>
            {filters.businessAreas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="input" value={filterState.manager || ''} onChange={(e) => setFilterState({ ...filterState, manager: e.target.value })}>
            <option value="">All Managers</option>
            {filters.managers.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
          <select className="input" value={filterState.technology || ''} onChange={(e) => setFilterState({ ...filterState, technology: e.target.value })}>
            <option value="">All Technologies</option>
            {filters.technologies.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input" value={filterState.overdue || ''} onChange={(e) => setFilterState({ ...filterState, overdue: e.target.value })}>
            <option value="">All Items</option>
            <option value="true">Overdue Only</option>
          </select>
          <select className="input" value={filterState.threatMatched || ''} onChange={(e) => setFilterState({ ...filterState, threatMatched: e.target.value })}>
            <option value="">All Threat Intel</option>
            <option value="true">Threat Intel Matched</option>
          </select>
          <select className="input" value={filterState.activeExploitation || ''} onChange={(e) => setFilterState({ ...filterState, activeExploitation: e.target.value })}>
            <option value="">Active Exploitation</option>
            <option value="true">Actively Exploited</option>
          </select>
          <select className="input" value={filterState.publicExploit || ''} onChange={(e) => setFilterState({ ...filterState, publicExploit: e.target.value })}>
            <option value="">Public Exploit</option>
            <option value="true">Exploit Available</option>
          </select>
          <select className="input" value={filterState.ransomware || ''} onChange={(e) => setFilterState({ ...filterState, ransomware: e.target.value })}>
            <option value="">Ransomware</option>
            <option value="true">Ransomware Linked</option>
          </select>
          <select className="input" value={filterState.threatActor || ''} onChange={(e) => setFilterState({ ...filterState, threatActor: e.target.value })}>
            <option value="">Threat Actor</option>
            <option value="true">Actor Associated</option>
          </select>
          <select className="input" value={filterState.threatPriority || ''} onChange={(e) => setFilterState({ ...filterState, threatPriority: e.target.value })}>
            <option value="">Threat Priority</option>
            <option value="CRITICAL">Critical Threat Priority</option>
            <option value="HIGH">High Threat Priority</option>
            <option value="NORMAL">Normal Threat Priority</option>
          </select>
          <select className="input" value={filterState.riskRating || ''} onChange={(e) => setFilterState({ ...filterState, riskRating: e.target.value })}>
            <option value="">All Risk Ratings</option>
            {RISK_RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className="input" value={filterState.businessCriticality || ''} onChange={(e) => setFilterState({ ...filterState, businessCriticality: e.target.value })}>
            <option value="">Asset Criticality</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={filterState.internetFacing || ''} onChange={(e) => setFilterState({ ...filterState, internetFacing: e.target.value })}>
            <option value="">Internet Facing</option>
            <option value="true">Internet Facing</option>
          </select>
          <select className="input" value={filterState.criticalService || ''} onChange={(e) => setFilterState({ ...filterState, criticalService: e.target.value })}>
            <option value="">Critical Service</option>
            <option value="true">Critical Service</option>
          </select>
          <select className="input" value={filterState.critical || ''} onChange={(e) => setFilterState({ ...filterState, critical: e.target.value })}>
            <option value="">All Severities</option>
            <option value="true">Critical Only</option>
          </select>
          <button onClick={() => { setFilterState({}); setPage(1); }} className="btn-ghost">Clear Filters</button>
        </div>
      )}

      {canAssign && selected.size > 0 && (
        <div className="card mb-4 flex flex-wrap items-center gap-4 border-brand-500/30 bg-brand-500/5">
          <span className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4 text-brand-500" />
            {selected.size} selected
          </span>
          <select className="input w-64" value={assignOwner} onChange={(e) => setAssignOwner(e.target.value)}>
            <option value="">Assign to SME...</option>
            {filters?.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={bulkAssign} disabled={assigning} className="btn-primary">
            <UserPlus className="h-4 w-4" /> {assigning ? 'Assigning...' : 'Bulk Assign'}
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-ghost text-sm">Clear</button>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-800/50">
                  {canAssign && (
                    <th className="px-4 py-3">
                      <input type="checkbox" checked={selected.size === findings.length && findings.length > 0} onChange={toggleAll} />
                    </th>
                  )}
                  {['ID', 'Title', 'Service', 'Asset', 'Risk', 'Rating', 'Reason', 'Threat', 'Severity', 'CVSS', 'Crit.', 'Exposure', 'Owner', 'Status', 'Target', 'Days', 'Evidence'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                {findings.map((f) => (
                  <tr key={f.id} className={cn('transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/30', selected.has(f.id) && 'bg-brand-500/5')}>
                    {canAssign && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggleSelect(f.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <Link href={`/findings/${f.findingId}`} className="font-mono text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
                        {f.findingId}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium">{f.title}</td>
                    <td className="px-4 py-3 text-xs">{f.service?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.assetRecord?.name || f.asset || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold">{f.exposureRiskScore ?? '—'}</td>
                    <td className="px-4 py-3"><RiskRatingBadge rating={f.exposureRiskRating} /></td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-xs text-surface-500" title={f.exposureRiskReason}>{f.exposureRiskReason || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <ThreatIntelBadge matched={f.hasThreatMatch} />
                        <ThreatPriorityBadge priority={f.threatPriority} />
                      </div>
                    </td>
                    <td className="px-4 py-3"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-4 py-3 font-mono text-xs">{f.cvssScore.toFixed(1)}</td>
                    <td className="px-4 py-3 text-xs">{f.assetRecord?.businessCriticality || '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.exposureLevel ? (EXPOSURE_LABELS[f.exposureLevel] || f.exposureLevel) : '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.owner?.name || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3 text-xs">{formatDate(f.targetDate)}</td>
                    <td className={cn('px-4 py-3 text-xs font-medium', slaStatusColor(f.slaStatus))}>
                      {f.daysRemaining < 0 ? `${Math.abs(f.daysRemaining)}d overdue` : `${f.daysRemaining}d`}
                    </td>
                    <td className="px-4 py-3 text-center text-xs">{f.evidenceCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-surface-500">Page {page} of {totalPages}</p>
        <div className="flex gap-2">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="btn-secondary">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn-secondary">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ProtectedLayout>
  );
}
