'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { formatDateTime } from '@/lib/utils';
import { Users, Building, AppWindow, Plug, History } from 'lucide-react';

export default function AdminPage() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [integrations, setIntegrations] = useState<Record<string, unknown> | null>(null);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<Record<string, unknown>[]>('/admin/users'),
      apiFetch<Record<string, unknown>[]>('/admin/teams'),
      apiFetch<Record<string, unknown>[]>('/admin/applications'),
      apiFetch<Record<string, unknown>>('/integrations'),
      apiFetch<Record<string, unknown>[]>('/admin/audit-logs?limit=50'),
    ])
      .then(([u, t, a, i, l]) => {
        setUsers(u); setTeams(t); setApps(a); setIntegrations(i); setAuditLogs(l);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'teams', label: 'Teams', icon: Building },
    { id: 'apps', label: 'Applications', icon: AppWindow },
    { id: 'integrations', label: 'Integrations', icon: Plug },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ];

  return (
    <ProtectedLayout>
      <PageHeader title="Administration" description="User management, integrations and audit logging" />

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'border-b-2 border-brand-500 text-brand-600' : 'text-surface-500'
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800">
                {['Name', 'Email', 'Role', 'Team', 'Department', 'Last Login'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {users.map((u) => {
                const user = u as { id: string; name: string; email: string; role: string; department: string; team: { name: string }; lastLoginAt: string };
                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-xs">{user.email}</td>
                    <td className="px-4 py-3 text-xs">{user.role?.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-xs">{user.team?.name || '—'}</td>
                    <td className="px-4 py-3 text-xs">{user.department || '—'}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(user.lastLoginAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'teams' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const team = t as { id: string; name: string; businessArea: string; _count: { members: number; findings: number } };
            return (
              <div key={team.id} className="card">
                <h3 className="font-semibold">{team.name}</h3>
                <p className="text-sm text-surface-500">{team.businessArea}</p>
                <div className="mt-3 flex gap-4 text-xs text-surface-500">
                  <span>{team._count.members} members</span>
                  <span>{team._count.findings} findings</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'apps' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-800">
                {['Application', 'Business Service', 'Area', 'Stack', 'Cloud', 'Findings'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {apps.map((a) => {
                const app = a as { id: string; name: string; businessService: string; businessArea: string; technologyStack: string; cloudPlatform: string; _count: { findings: number } };
                return (
                  <tr key={app.id}>
                    <td className="px-4 py-3 font-medium">{app.name}</td>
                    <td className="px-4 py-3 text-xs">{app.businessService}</td>
                    <td className="px-4 py-3 text-xs">{app.businessArea}</td>
                    <td className="px-4 py-3 text-xs">{app.technologyStack}</td>
                    <td className="px-4 py-3 text-xs">{app.cloudPlatform}</td>
                    <td className="px-4 py-3 text-xs">{app._count.findings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'integrations' && integrations && (
        <div>
          <div className="card mb-6">
            <h3 className="mb-2 font-semibold">Integration Architecture</h3>
            <p className="text-sm text-surface-500">
              {(integrations as { architecture: { pattern: string; dataFlow: string } }).architecture.pattern}
            </p>
            <p className="mt-2 text-xs text-surface-400">
              {(integrations as { architecture: { dataFlow: string } }).architecture.dataFlow}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {((integrations as { integrations: { name: string; type: string; description: string; status: string }[] }).integrations || []).map((i) => (
              <div key={i.name} className="card">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{i.name}</h3>
                  <span className="badge border border-amber-500/30 bg-amber-500/10 text-amber-400">{i.status}</span>
                </div>
                <p className="mt-1 text-xs text-brand-500">{i.type}</p>
                <p className="mt-2 text-sm text-surface-500">{i.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="space-y-2">
            {auditLogs.map((l) => {
              const log = l as { id: string; action: string; entityType: string; user: { name: string }; createdAt: string; ipAddress: string };
              return (
                <div key={log.id} className="flex items-center justify-between border-b border-surface-100 py-2 last:border-0 dark:border-surface-800">
                  <div>
                    <p className="text-sm"><span className="font-medium">{log.user?.name || 'System'}</span> — {log.action} on {log.entityType}</p>
                    <p className="text-xs text-surface-500">IP: {log.ipAddress || '—'}</p>
                  </div>
                  <span className="text-xs text-surface-500">{formatDateTime(log.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
