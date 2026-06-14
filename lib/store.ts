'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiPath, logApiCall, parseJsonResponse } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  teamId?: string;
  department?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'crh-auth' }
  )
);

interface ThemeState {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      darkMode: true,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
    }),
    { name: 'crh-theme' }
  )
);

interface DebugState {
  lastApiCall: string;
  lastApiMethod: string;
  setLastApiCall: (path: string, method: string) => void;
}

export const useDebugStore = create<DebugState>()((set) => ({
  lastApiCall: '—',
  lastApiMethod: '—',
  setLastApiCall: (path, method) => set({ lastApiCall: path, lastApiMethod: method }),
}));

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = apiPath(path);
  logApiCall(options.method || 'GET', path);
  useDebugStore.getState().setLastApiCall(url, options.method || 'GET');

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await parseJsonResponse<{ error?: string }>(res).catch((e) => ({
      error: e instanceof Error ? e.message : 'Request failed',
    }));
    throw new Error(err.error || 'Request failed');
  }
  return parseJsonResponse<T>(res);
}
