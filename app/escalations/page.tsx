'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, SeverityBadge } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { formatDateTime, escalationLabel } from '@/lib/utils';
import { AlertTriangle, ArrowUp } from 'lucide-react';

export default function EscalationsPage() {
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [active, setActive] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ events: Record<string, unknown>[]; active: Record<string, unknown>[] }>('/escalations')
      .then((d) => { setEvents(d.events); setActive(d.active); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Escalations"
        description="Automated escalation workflow — no manual chasing required"
      />

      <div className="mb-8">
        <h2 className="mb-4 font-display text-lg font-semibold">Active Escalations ({active.length})</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((f) => {
            const finding = f as Record<string, unknown>;
            const findingData = finding as {
              id: string; findingId: string; title: string; severity: string;
              escalationLevel: string; owner: { name: string }; team: { name: string };
            };
            return (
              <div key={findingData.id} className="card-hover border-l-4 border-l-red-500">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/findings/${findingData.findingId}`} className="font-mono text-xs text-brand-600 hover:underline">
                    {findingData.findingId}
                  </Link>
                  <SeverityBadge severity={findingData.severity} />
                </div>
                <p className="mb-2 text-sm font-medium">{findingData.title}</p>
                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <ArrowUp className="h-3 w-3" />
                  {escalationLabel(findingData.escalationLevel)}
                </div>
                <p className="mt-2 text-xs text-surface-500">
                  Owner: {findingData.owner?.name || 'Unassigned'} | Team: {findingData.team?.name || '—'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 font-display text-lg font-semibold">Escalation History</h2>
        <div className="space-y-3">
          {events.map((e) => {
            const event = e as {
              id: string; level: string; message: string; createdAt: string; channel: string;
              finding: { findingId: string; title: string; severity: string };
            };
            return (
              <div key={event.id} className="flex gap-4 border-b border-surface-100 py-3 last:border-0 dark:border-surface-800">
                <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/findings/${event.finding.findingId}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {event.finding.findingId}
                    </Link>
                    <SeverityBadge severity={event.finding.severity} />
                    <span className="text-xs text-surface-500">{escalationLabel(event.level)}</span>
                  </div>
                  <p className="mt-1 text-sm">{event.message}</p>
                  <p className="mt-1 text-xs text-surface-500">{formatDateTime(event.createdAt)} via {event.channel}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ProtectedLayout>
  );
}
