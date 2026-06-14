'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, MetricCard } from '@/components/ui';
import { BarChartWidget, TrendChart, LineTrendChart } from '@/components/charts';
import { apiFetch } from '@/lib/store';
import { Activity, Shield, Clock, Target } from 'lucide-react';

export default function AnalyticsPage() {
  const [exec, setExec] = useState<Record<string, unknown> | null>(null);
  const [charts, setCharts] = useState<Record<string, unknown> | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/dashboard/executive'),
      apiFetch('/dashboard/charts'),
      apiFetch('/dashboard/analytics'),
    ])
      .then(([e, c, a]) => {
        setExec(e as Record<string, unknown>);
        setCharts(c as Record<string, unknown>);
        setAnalytics(a as Record<string, unknown>);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const cards = (exec as { cards: Record<string, number> })?.cards;
  const chartData = charts as {
    bySeverity: { name: string; value: number }[];
    monthlyTrend: { month: string; opened: number; closed: number }[];
    byBusinessArea: { name: string; value: number }[];
  };
  const analyticsData = analytics as {
    byCategory: { category: string; open: number; total: number; avgRisk: number }[];
    topRisks: { findingId: string; title: string; severity: string; recoveryScore: number }[];
  };

  return (
    <ProtectedLayout>
      <PageHeader
        title="Analytics & Reports"
        description="Power BI style analytics for cyber recovery performance"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Open Findings" value={cards?.totalOpen || 0} icon={Activity} />
        <MetricCard title="SLA Compliance" value={`${cards?.withinSlaPercent || 0}%`} icon={Target} color="green" />
        <MetricCard title="MTTR" value={`${cards?.mttr || 0} days`} icon={Clock} />
        <MetricCard title="Total Findings" value={(analytics as { totalFindings: number })?.totalFindings || 0} icon={Shield} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Risk Trend</h3>
          {chartData && <TrendChart data={chartData.monthlyTrend} />}
        </div>
        <div className="card">
          <h3 className="mb-4 font-display text-lg font-semibold">Open vs Closed by Severity</h3>
          {chartData && <BarChartWidget data={chartData.bySeverity} />}
        </div>
      </div>

      <div className="mb-8">
        <h3 className="mb-4 font-display text-lg font-semibold">Technology Categories</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(analyticsData?.byCategory || []).map((cat) => (
            <div key={cat.category} className="card text-center">
              <p className="text-sm font-medium text-surface-500">{cat.category}</p>
              <p className="mt-2 font-display text-2xl font-bold">{cat.open}</p>
              <p className="text-xs text-surface-500">open of {cat.total}</p>
              <p className="mt-1 text-xs text-brand-500">Avg risk: {cat.avgRisk}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="mb-4 font-display text-lg font-semibold">Top Risks</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800">
                {['Finding ID', 'Title', 'Severity', 'Recovery Score'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(analyticsData?.topRisks || []).map((r) => (
                <tr key={r.findingId} className="border-b border-surface-100 dark:border-surface-800">
                  <td className="px-4 py-2 font-mono text-xs">{r.findingId}</td>
                  <td className="px-4 py-2">{r.title}</td>
                  <td className="px-4 py-2">{r.severity}</td>
                  <td className="px-4 py-2 font-medium">{Math.round(r.recoveryScore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedLayout>
  );
}
