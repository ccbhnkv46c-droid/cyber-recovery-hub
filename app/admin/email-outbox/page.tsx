'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { BRAND } from '@/lib/branding';
import { formatDateTime } from '@/lib/utils';
import { Mail } from 'lucide-react';

interface EmailLog {
  id: string;
  action: string;
  entityType: string;
  newValue: string;
  createdAt: string;
  user: { name: string; email: string } | null;
}

export default function EmailOutboxPage() {
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<EmailLog[]>('/admin/email-outbox')
      .then(setEmails)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Email Outbox"
        description={`All automated email notifications sent by ${BRAND.shortName}`}
      />

      <div className="space-y-3">
        {emails.map((e) => {
          let parsed: { to?: string; subject?: string; findingId?: string } = {};
          try { parsed = JSON.parse(e.newValue || '{}'); } catch {}
          return (
            <div key={e.id} className="card">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{parsed.subject || 'Email notification'}</p>
                    <span className="text-xs text-surface-500">{formatDateTime(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    To: {parsed.to || '—'} · Finding: {parsed.findingId || '—'}
                  </p>
                  {e.user && (
                    <p className="mt-1 text-xs text-surface-400">Triggered by {e.user.name}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {emails.length === 0 && (
          <p className="py-12 text-center text-surface-500">
            No emails sent yet. Emails are logged when vulnerabilities are updated.
          </p>
        )}
      </div>
    </ProtectedLayout>
  );
}
