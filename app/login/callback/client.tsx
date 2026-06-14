'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { LoadingSpinner } from '@/components/ui';
import { apiPath, logApiCall, parseJsonResponse, safeAppRoute } from '@/lib/api-client';

export default function LoginCallbackClient() {
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    const route = safeAppRoute(searchParams.get('route'), '/dashboard');

    if (token) {
      logApiCall('GET', '/auth/me');
      fetch(apiPath('/auth/me'), { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => parseJsonResponse<{
          id: string; email: string; name: string; role: string;
          teamId?: string; department?: string;
        }>(r))
        .then((user) => {
          setAuth(token, user);
          router.push(route);
        })
        .catch(() => router.push('/login?error=sso_failed'));
    } else {
      router.push('/login?error=sso_failed');
    }
  }, [searchParams, setAuth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-sm text-surface-500">Completing Entra ID sign-in...</p>
      </div>
    </div>
  );
}
