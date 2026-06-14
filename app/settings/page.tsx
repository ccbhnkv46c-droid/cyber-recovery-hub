'use client';

import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader } from '@/components/ui';
import { useThemeStore, useAuthStore } from '@/lib/store';
import { Moon, Sun, User, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
  const { darkMode, toggleDarkMode } = useThemeStore();
  const { user } = useAuthStore();

  return (
    <ProtectedLayout>
      <PageHeader title="Settings" description="Platform preferences and configuration" />

      <div className="max-w-2xl space-y-6">
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <User className="h-4 w-4" /> Profile
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-surface-500">Name</dt><dd className="font-medium">{user?.name}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Email</dt><dd>{user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Role</dt><dd>{user?.role?.replace(/_/g, ' ')}</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Department</dt><dd>{user?.department || '—'}</dd></div>
          </dl>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            {darkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Appearance
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-surface-500">Toggle between light and dark themes</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative h-6 w-11 rounded-full transition-colors ${darkMode ? 'bg-brand-600' : 'bg-surface-300'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${darkMode ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Bell className="h-4 w-4" /> Notifications
          </h3>
          <div className="space-y-3">
            {['Dashboard notifications', 'Daily digest (configured)', 'Weekly summary (configured)'].map((n) => (
              <div key={n} className="flex items-center justify-between">
                <span className="text-sm">{n}</span>
                <span className="badge border border-green-500/30 bg-green-500/10 text-green-400">Active</span>
              </div>
            ))}
            {['Email notifications', 'Microsoft Teams alerts'].map((n) => (
              <div key={n} className="flex items-center justify-between">
                <span className="text-sm">{n}</span>
                <span className="badge border border-surface-500/30 bg-surface-500/10 text-surface-400">Integration required</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <Shield className="h-4 w-4" /> Security
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-surface-500">Authentication</dt><dd>Development SSO (Entra ID ready)</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Encryption</dt><dd>TLS in transit; at-rest in production</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Audit Logging</dt><dd className="text-green-500">Active (login, changes, escalations)</dd></div>
            <div className="flex justify-between"><dt className="text-surface-500">Session Timeout</dt><dd>8 hours (configurable)</dd></div>
          </dl>
        </div>
      </div>
    </ProtectedLayout>
  );
}
