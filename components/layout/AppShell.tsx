'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Shield, List, UserCheck, AlertTriangle, BarChart3,
  Settings, LogOut, Moon, Sun, Bell, Menu, Bot, Building2, CheckSquare, Upload, Server, Mail, CheckCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore, useThemeStore, apiFetch } from '@/lib/store';
import { getNavForRole, APP_VERSION } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { DebugPanel } from '@/components/layout/DebugPanel';

const ICON_MAP = {
  LayoutDashboard, List, UserCheck, AlertTriangle, BarChart3, Bot, Building2, Settings, CheckSquare, Upload, Server, Bell, Mail, CheckCircle,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout, token } = useAuthStore();
  const { darkMode, toggleDarkMode } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const navItems = user?.role ? getNavForRole(user.role) : [];
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (token) {
      apiFetch<{ count: number }>('/notifications/unread-count')
        .then((d) => setNotifCount(d.count))
        .catch(() => {});
    }
  }, [token, pathname]);

  const handleLogout = async () => {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    logout();
    window.location.href = '/login';
  };

  let lastSection = '';

  return (
    <div className="flex min-h-screen bg-surface-50 dark:bg-surface-950">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900 transition-transform lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center gap-3 border-b border-surface-200 px-6 dark:border-surface-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-display text-sm font-bold text-surface-900 dark:text-white">Cyber Recovery</p>
            <p className="text-[10px] text-surface-500">Hub v{APP_VERSION}</p>
          </div>
        </div>

        {isAdmin && (
          <div className="mx-4 mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-500">Administrator</p>
            <p className="text-xs text-surface-600 dark:text-surface-400">Full platform access</p>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon as keyof typeof ICON_MAP] || LayoutDashboard;
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
            const showSection = isAdmin && item.section && item.section !== lastSection;
            if (showSection) lastSection = item.section!;

            return (
              <div key={item.href}>
                {showSection && (
                  <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-wider text-surface-400 first:mt-0">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={active ? 'nav-link-active' : 'nav-link'}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-surface-200 p-4 dark:border-surface-800">
          <div className="mb-3 rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <p className="text-sm font-medium text-surface-900 dark:text-white">{user?.name}</p>
            <p className={cn('text-xs', isAdmin ? 'font-semibold text-brand-500' : 'text-surface-500')}>
              {user?.role?.replace(/_/g, ' ')}
            </p>
          </div>
          <button onClick={handleLogout} className="nav-link w-full text-red-500 hover:text-red-600">
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-surface-200 bg-white/80 px-6 backdrop-blur dark:border-surface-800 dark:bg-surface-900/80">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-surface-500 lg:block">
            {isAdmin ? 'Administrator Console' : user?.department}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="btn-ghost relative">
              <Bell className="h-4 w-4" />
              {notifCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                  {notifCount}
                </span>
              )}
            </Link>
            <button onClick={toggleDarkMode} className="btn-ghost">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      <DebugPanel />
    </div>
  );
}
