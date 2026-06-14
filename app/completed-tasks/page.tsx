'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, MetricCard, LoadingSpinner } from '@/components/ui';
import { LeaderboardChart } from '@/components/charts';
import { apiFetch } from '@/lib/store';
import { usePolling } from '@/lib/hooks/usePolling';
import { formatDate } from '@/lib/utils';
import { CheckCircle, Calendar, Clock, Timer, Trophy, Filter } from 'lucide-react';

interface CompletedData {
  stats: {
    total: number;
    completedToday: number;
    completedThisWeek: number;
    completedThisMonth: number;
    avgRemediationDays: number;
  };
  bySme: { id: string; name: string; totalCompleted: number; completedThisMonth: number; avgRemediationDays: number }[];
  findings: Record<string, unknown>[];
  pagination: { page: number; pages: number; total: number };
  updatedAt: string;
}

interface Filters {
  services: { id: string; name: string }[];
  owners: { id: string; name: string }[];
}

export default function CompletedTasksPage() {
  const [data, setData] = useState<CompletedData | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    Object.entries(filterState).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const result = await apiFetch<CompletedData>(`/dashboard/completed?${params}`);
      setData(result);
      setLastUpdated(new Date(result.updatedAt).toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, filterState]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    apiFetch<Filters>('/admin/filters').then(setFilters).catch(console.error);
  }, []);
  usePolling(loadData, 15000, !loading);

  if (loading && !data) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const stats = data?.stats;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Completed Tasks"
        description="Archived remediations — closed vulnerabilities remain in the database for audit and reporting"
        actions={
          lastUpdated && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Live · Updated {lastUpdated}
            </span>
          )
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Total Completed" value={stats?.total || 0} icon={CheckCircle} color="green" />
        <MetricCard title="Completed Today" value={stats?.completedToday || 0} icon={Calendar} color="brand" />
        <MetricCard title="Completed This Week" value={stats?.completedThisWeek || 0} icon={Clock} color="brand" />
        <MetricCard title="Completed This Month" value={stats?.completedThisMonth || 0} icon={Trophy} color="yellow" />
        <MetricCard title="Avg Time to Remediate" value={`${stats?.avgRemediationDays || 0}d`} icon={Timer} color="green" />
      </div>

      <div className="mb-6 card">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-500" />
          <h3 className="font-display font-semibold">Filters</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <select
            className="input"
            value={filterState.serviceId || ''}
            onChange={(e) => { setFilterState((s) => ({ ...s, serviceId: e.target.value })); setPage(1); }}
          >
            <option value="">All Services</option>
            {filters?.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            className="input"
            value={filterState.ownerId || ''}
            onChange={(e) => { setFilterState((s) => ({ ...s, ownerId: e.target.value })); setPage(1); }}
          >
            <option value="">All SMEs</option>
            {filters?.owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select
            className="input"
            value={filterState.severity || ''}
            onChange={(e) => { setFilterState((s) => ({ ...s, severity: e.target.value })); setPage(1); }}
          >
            <option value="">All Severities</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="date"
            className="input"
            value={filterState.from || ''}
            onChange={(e) => { setFilterState((s) => ({ ...s, from: e.target.value })); setPage(1); }}
            placeholder="From"
          />
          <input
            type="date"
            className="input"
            value={filterState.to || ''}
            onChange={(e) => { setFilterState((s) => ({ ...s, to: e.target.value })); setPage(1); }}
            placeholder="To"
          />
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Completed by SME</h3>
          {data?.bySme && (
            <LeaderboardChart
              data={data.bySme.map((s) => ({
                name: s.name.split(' ')[0],
                totalCompleted: s.totalCompleted,
                completedThisMonth: s.completedThisMonth,
              }))}
            />
          )}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">SME Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800">
                  {['SME', 'Total', 'This Month', 'Avg MTTR'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                {data?.bySme.map((sme) => (
                  <tr key={sme.id}>
                    <td className="px-3 py-2 font-medium">{sme.name}</td>
                    <td className="px-3 py-2">{sme.totalCompleted}</td>
                    <td className="px-3 py-2">{sme.completedThisMonth}</td>
                    <td className="px-3 py-2">{sme.avgRemediationDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="mb-4 font-display text-lg font-semibold">Closed Vulnerabilities</h2>
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-800/50">
                {['Finding ID', 'Title', 'Service', 'Severity', 'SME', 'Closed Date', 'MTTR', ''].map((h) => (
                  <th key={h || 'link'} className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {data?.findings.map((f) => {
                const owner = f.owner as { name: string } | undefined;
                const service = f.service as { name: string } | undefined;
                return (
                  <tr key={f.id as string} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                    <td className="px-4 py-3 font-mono text-xs">{f.findingId as string}</td>
                    <td className="max-w-[200px] truncate px-4 py-3">{f.title as string}</td>
                    <td className="px-4 py-3 text-xs">{service?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.severity as string}</td>
                    <td className="px-4 py-3 text-xs">{owner?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.closedAt ? formatDate(f.closedAt as string) : '—'}</td>
                    <td className="px-4 py-3 text-xs">{f.remediationDays as number}d</td>
                    <td className="px-4 py-3">
                      <Link href={`/findings/${f.findingId}`} className="text-xs text-brand-600 hover:underline">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data?.findings.length === 0 && (
          <div className="py-12 text-center text-surface-500">No completed tasks match your filters</div>
        )}
        {data && data.pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3 dark:border-surface-800">
            <span className="text-xs text-surface-500">Page {page} of {data.pagination.pages}</span>
            <div className="flex gap-2">
              <button className="btn-ghost text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="btn-ghost text-xs" disabled={page >= data.pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
