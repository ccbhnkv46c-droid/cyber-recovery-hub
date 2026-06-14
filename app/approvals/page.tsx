'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner, SeverityBadge, StatusBadge } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

interface PendingFinding {
  id: string;
  findingId: string;
  title: string;
  severity: string;
  status: string;
  targetDate: string;
  exceptionReason?: string;
  owner?: { name: string };
  team?: { name: string };
  application?: { name: string };
}

export default function ApprovalsPage() {
  const [pending, setPending] = useState<PendingFinding[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    apiFetch<PendingFinding[]>('/approvals/pending')
      .then(setPending)
      .catch(() => toast('Failed to load approvals', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const approveExtension = async (id: string) => {
    const newDate = prompt('New target date (YYYY-MM-DD):');
    if (!newDate) return;
    try {
      await apiFetch(`/approvals/${id}/approve-extension`, {
        method: 'POST',
        body: JSON.stringify({ newTargetDate: newDate }),
      });
      toast('Extension approved', 'success');
      load();
    } catch {
      toast('Failed to approve extension', 'error');
    }
  };

  const approveException = async (id: string) => {
    try {
      await apiFetch(`/approvals/${id}/approve-exception`, {
        method: 'POST',
        body: JSON.stringify({ expiryDays: 90 }),
      });
      toast('Exception approved', 'success');
      load();
    } catch {
      toast('Failed to approve exception', 'error');
    }
  };

  const reject = async (id: string) => {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    try {
      await apiFetch(`/approvals/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast('Request rejected', 'info');
      load();
    } catch {
      toast('Failed to reject request', 'error');
    }
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Approvals"
        description="Review extension requests and risk acceptance exceptions"
      />

      {pending.length === 0 ? (
        <div className="card py-16 text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <p className="text-lg font-medium">No pending approvals</p>
          <p className="mt-2 text-sm text-surface-500">All extension and exception requests have been processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((f) => (
            <div key={f.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Link href={`/findings/${f.findingId}`} className="font-mono text-sm text-brand-600 hover:underline">
                      {f.findingId}
                    </Link>
                    <SeverityBadge severity={f.severity} />
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="font-medium">{f.title}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-surface-500">
                    <span>Owner: {f.owner?.name || '—'}</span>
                    <span>Team: {f.team?.name || '—'}</span>
                    <span>Target: {formatDate(f.targetDate)}</span>
                  </div>
                  {f.exceptionReason && (
                    <p className="mt-2 rounded-lg bg-surface-100 p-2 text-sm dark:bg-surface-800">
                      Reason: {f.exceptionReason}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {f.status === 'PENDING_REVIEW' && (
                    <button onClick={() => approveExtension(f.findingId)} className="btn-primary text-xs">
                      <Clock className="h-3 w-3" /> Approve Extension
                    </button>
                  )}
                  {f.status === 'PENDING_EXCEPTION' && (
                    <button onClick={() => approveException(f.findingId)} className="btn-primary text-xs">
                      <CheckCircle className="h-3 w-3" /> Approve Exception
                    </button>
                  )}
                  <button onClick={() => reject(f.findingId)} className="btn-secondary text-xs text-red-500">
                    <XCircle className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
