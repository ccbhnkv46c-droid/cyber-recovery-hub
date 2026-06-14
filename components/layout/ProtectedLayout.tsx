'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, apiFetch } from '@/lib/store';
import { canAccessRoute, getDefaultRoute } from '@/lib/rbac';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingSpinner } from '@/components/ui';

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { token, user, setAuth, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);

  // Refresh user role from server — prevents stale localStorage showing wrong nav
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    setSessionReady(false);
    apiFetch<{
      id: string; email: string; name: string; role: string;
      teamId?: string; department?: string;
    }>('/auth/me')
      .then((freshUser) => {
        setAuth(token, {
          id: freshUser.id,
          email: freshUser.email,
          name: freshUser.name,
          role: freshUser.role,
          teamId: freshUser.teamId,
          department: freshUser.department,
        });
        setSessionReady(true);
      })
      .catch(() => {
        logout();
        router.push('/login');
      });
  }, [token, router, setAuth, logout]);

  useEffect(() => {
    if (!sessionReady || !user?.role) return;
    if (!canAccessRoute(user.role, pathname)) {
      router.push(getDefaultRoute(user.role));
    }
  }, [sessionReady, user, pathname, router]);

  if (!token || !sessionReady || !user?.role) return <LoadingSpinner />;
  if (!canAccessRoute(user.role, pathname)) return <LoadingSpinner />;

  return <AppShell>{children}</AppShell>;
}
