'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, MetricCard } from '@/components/ui';
import { DashboardSkeleton } from '@/components/ui/Skeleton';
import { LineTrendChart } from '@/components/charts';
import { apiFetch } from '@/lib/store';
import { exportBoardPDF } from '@/lib/export';
import { toast } from '@/lib/toast';
import { Shield, AlertTriangle, Target, TrendingUp, Download } from 'lucide-react';

export default function BoardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, unknown>>('/dashboard/board').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedLayout><DashboardSkeleton /></ProtectedLayout>;

  const board = data as {
    totalCyberRisk: number;
    criticalFindings: number;
    openFindings: number;
    slaCompliance: number;
    overdueFindings: number;
    riskTrend: { month: string; risk: number }[];
    recoveryPerformance: number;
  };

  const handleExport = () => {
    exportBoardPDF(board);
    toast('Board summary exported', 'success');
  };

  return (
    <ProtectedLayout>
      <PageHeader
        title="Board Dashboard"
        description="Governance-level recover oversight — read-only"
        actions={
          <button onClick={handleExport} className="btn-secondary">
            <Download className="h-4 w-4" /> Export Board Pack
          </button>
        }
      />

      <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
        Read-only view. For detailed findings, contact the CISO office.
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Total Cyber Risk" value={board.totalCyberRisk} icon={Shield} color="red" subtitle="Aggregate recover score" />
        <MetricCard title="Critical Findings" value={board.criticalFindings} icon={AlertTriangle} color="red" />
        <MetricCard title="SLA Compliance" value={`${board.slaCompliance}%`} icon={Target} color="green" />
        <MetricCard title="Recover Performance" value={`${board.recoveryPerformance}%`} icon={TrendingUp} color="brand" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Risk Trend (6 months)</h3>
          <LineTrendChart data={board.riskTrend} />
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Governance Summary</h3>
          <dl className="space-y-4">
            <div className="flex justify-between border-b border-surface-200 pb-3 dark:border-surface-800">
              <dt className="text-surface-500">Open Findings</dt>
              <dd className="font-display text-xl font-bold">{board.openFindings}</dd>
            </div>
            <div className="flex justify-between border-b border-surface-200 pb-3 dark:border-surface-800">
              <dt className="text-surface-500">Overdue Findings</dt>
              <dd className="font-display text-xl font-bold text-red-500">{board.overdueFindings}</dd>
            </div>
            <div className="flex justify-between border-b border-surface-200 pb-3 dark:border-surface-800">
              <dt className="text-surface-500">Critical Exposure</dt>
              <dd className="font-display text-xl font-bold text-orange-500">{board.criticalFindings}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-500">SLA Compliance</dt>
              <dd className="font-display text-xl font-bold text-green-500">{board.slaCompliance}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </ProtectedLayout>
  );
}
