'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, MetricCard } from '@/components/ui';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { apiFetch } from '@/lib/store';
import { usePolling } from '@/lib/hooks/usePolling';
import { cn, formatDate, slaStatusColor } from '@/lib/utils';
import { Clock, AlertTriangle, Calendar, Shield, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';

type QueueTab = 'all' | 'critical' | 'high' | 'overdue' | 'due-week' | 'recent';

export default function MyActionsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = useCallback(async () => {
    try {
      const result = await apiFetch<Record<string, unknown> & { updatedAt?: string }>('/dashboard/engineer-portal');
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  usePolling(loadData, 15000, !loading);

  if (loading && !data) return <ProtectedLayout><div className="p-6"><TableSkeleton rows={6} cols={8} /></div></ProtectedLayout>;

  const portal = data as {
    myFindings: Record<string, unknown>[];
    overdue: number;
    dueThisWeek: number;
    critical: number;
    high: number;
    recentlyUpdated: Record<string, unknown>[];
    openCount: number;
  };

  const now = new Date();
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);

  const getFiltered = () => {
    switch (activeTab) {
      case 'critical':
        return portal.myFindings.filter((f) => f.severity === 'CRITICAL');
      case 'high':
        return portal.myFindings.filter((f) => f.severity === 'HIGH');
      case 'overdue':
        return portal.myFindings.filter((f) => (f.daysRemaining as number) < 0);
      case 'due-week':
        return portal.myFindings.filter((f) => {
          const d = new Date(f.targetDate as string);
          return d >= now && d <= weekEnd;
        });
      case 'recent':
        return portal.recentlyUpdated;
      default:
        return portal.myFindings;
    }
  };

  const displayed = getFiltered();
  const tabs: { id: QueueTab; label: string; count: number }[] = [
    { id: 'all', label: 'My Open Tasks', count: portal.openCount },
    { id: 'critical', label: 'Critical', count: portal.critical },
    { id: 'high', label: 'High', count: portal.high },
    { id: 'overdue', label: 'Overdue', count: portal.overdue },
    { id: 'due-week', label: 'Due This Week', count: portal.dueThisWeek },
    { id: 'recent', label: 'Recently Updated', count: portal.recentlyUpdated.length },
  ];

  return (
    <ProtectedLayout>
      <PageHeader
        title="My Dashboard"
        description="Your open assigned vulnerabilities — completed items are archived automatically"
        actions={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="flex items-center gap-1 text-xs text-surface-500">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Live · {lastUpdated}
              </span>
            )}
            <Link href="/completed-tasks" className="btn-secondary text-sm">
              <CheckCircle className="h-4 w-4" /> Completed Tasks
            </Link>
          </div>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="My Open Tasks" value={portal.openCount} icon={Clock} />
        <MetricCard title="Critical" value={portal.critical} icon={Shield} color="red" />
        <MetricCard title="High" value={portal.high} icon={AlertTriangle} color="orange" />
        <MetricCard title="Due This Week" value={portal.dueThisWeek} icon={Calendar} color="yellow" />
        <MetricCard title="Overdue" value={portal.overdue} icon={AlertTriangle} color="red" />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            {tab.label}
            <span className="ml-2 rounded-full bg-surface-200 px-2 py-0.5 text-xs dark:bg-surface-700">{tab.count}</span>
          </button>
        ))}
      </div>

      <h2 className="mb-4 font-display text-lg font-semibold">My Open Tasks</h2>

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-800/50">
                {['Finding ID', 'Title', 'Service', 'Severity', 'Status', 'Due Date', 'Days Remaining', 'Next Action', ''].map((h) => (
                  <th key={h || 'action'} className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {displayed.map((f) => {
                const finding = f as Record<string, unknown>;
                const daysRemaining = finding.daysRemaining as number;
                const slaStatus = daysRemaining < 0 ? 'overdue' : daysRemaining <= 3 ? 'red' : daysRemaining <= 7 ? 'amber' : 'green';
                const service = finding.service as { name: string } | undefined;
                return (
                  <tr key={finding.id as string} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                    <td className="px-4 py-3">
                      <Link href={`/findings/${finding.findingId}`} className="font-mono text-xs text-brand-600 hover:underline">
                        {finding.findingId as string}
                      </Link>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3">{finding.title as string}</td>
                    <td className="px-4 py-3 text-xs">{service?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', finding.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-400' : finding.severity === 'HIGH' ? 'bg-orange-500/15 text-orange-400' : 'bg-surface-500/15 text-surface-400')}>
                        {finding.severity as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{(finding.status as string).replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(finding.targetDate as string)}</td>
                    <td className={cn('px-4 py-3 text-xs font-medium', slaStatusColor(slaStatus))}>
                      {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d`}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-surface-500">
                      {(finding.nextAction as string) || (finding.nextSteps as string) || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/findings/${finding.findingId}?tab=actions`} className="btn-ghost text-xs">
                        <ExternalLink className="h-3 w-3" /> Update
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {displayed.length === 0 && (
          <div className="py-12 text-center text-surface-500">
            {activeTab === 'recent' ? (
              <>
                <RefreshCw className="mx-auto mb-3 h-8 w-8 text-surface-400" />
                No recent updates on your open tasks
              </>
            ) : (
              <>
                <CheckCircle className="mx-auto mb-3 h-8 w-8 text-green-500" />
                No open tasks in this view —{' '}
                <Link href="/completed-tasks" className="text-brand-600 hover:underline">view completed tasks</Link>
              </>
            )}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
