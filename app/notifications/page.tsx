'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { formatDateTime } from '@/lib/utils';
import { Bell } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Record<string, unknown>[]>('/notifications')
      .then(setNotifications)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setNotifications((n) => n.map((item) => ({ ...item, isRead: true })));
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Notifications"
        description="Dashboard notifications, reminders and escalation alerts"
        actions={<button onClick={markAllRead} className="btn-secondary">Mark All Read</button>}
      />

      <div className="space-y-3">
        {notifications.map((n) => {
          const notif = n as {
            id: string; title: string; message: string; isRead: boolean;
            createdAt: string; channel: string;
            finding: { findingId: string; severity: string } | null;
          };
          return (
            <div
              key={notif.id}
              className={`card flex gap-4 ${!notif.isRead ? 'border-l-4 border-l-brand-500' : ''}`}
            >
              <Bell className={`mt-1 h-4 w-4 shrink-0 ${notif.isRead ? 'text-surface-400' : 'text-brand-500'}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <span className="text-xs text-surface-500">{formatDateTime(notif.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-surface-500">{notif.message}</p>
                <div className="mt-2 flex gap-2 text-xs text-surface-400">
                  <span>{notif.channel}</span>
                  {notif.finding && <span>{notif.finding.findingId}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {notifications.length === 0 && (
          <p className="py-12 text-center text-surface-500">No notifications</p>
        )}
      </div>
    </ProtectedLayout>
  );
}
