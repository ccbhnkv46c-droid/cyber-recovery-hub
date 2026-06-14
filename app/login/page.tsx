'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, LogIn, User, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { getDefaultRoute } from '@/lib/rbac';
import { toast } from '@/lib/toast';
import { buildApiPath, parseJsonResponse } from '@/lib/urls';

const DEMO_USERS = [
  { email: 'administrator@crh.bank.com', role: 'Administrator', name: 'Administrator', password: 'AdminCrh2025!' },
  { email: 'richard.knight@crh.bank.com', role: 'SME', name: 'Richard Knight', password: 'RkCrh2025!' },
  { email: 'sammi.powell@crh.bank.com', role: 'SME', name: 'Sammi Powell', password: 'SpCrh2025!' },
  { email: 'michael.oconnor@crh.bank.com', role: 'SME', name: "Michael O'Connor", password: 'MoCrh2025!' },
  { email: 'steven.k@crh.bank.com', role: 'SME', name: 'Steven K', password: 'SkCrh2025!' },
  { email: 'analyst@bank.com', role: 'Security Analyst', name: 'Sarah Chen', password: 'demo123' },
  { email: 'ciso@bank.com', role: 'CISO', name: 'Michael Richardson', password: 'demo123' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [entraEnabled, setEntraEnabled] = useState(false);
  const { setAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetch(buildApiPath('/auth/sso-status'))
      .then((r) => parseJsonResponse<{ entraEnabled: boolean }>(r))
      .then((d) => setEntraEnabled(d.entraEnabled))
      .catch(() => {});
  }, []);

  const handleLogin = async (loginEmail?: string, loginPassword?: string) => {
    const e = loginEmail || email;
    const p = loginPassword || password;
    if (!e || !p) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildApiPath('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await parseJsonResponse<{
        token: string;
        user: { id: string; email: string; name: string; role: string; teamId?: string; department?: string };
        defaultRoute?: string;
        error?: string;
      }>(res);

      if (!res.ok) throw new Error(data.error || 'Login failed');

      setAuth(data.token, data.user);
      const me = await fetch(buildApiPath('/auth/me'), {
        headers: { Authorization: `Bearer ${data.token}` },
      }).then((r) => parseJsonResponse<{ role?: string }>(r));

      if (me?.role) setAuth(data.token, { ...data.user, ...me });
      toast(`Welcome back, ${data.user.name} (${me?.role || data.user.role})`, 'success');
      router.push(data.defaultRoute || getDefaultRoute(me?.role || data.user.role));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      setError(msg);
      toast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (userEmail: string, userPassword?: string) => {
    const user = DEMO_USERS.find((u) => u.email === userEmail);
    setEmail(userEmail);
    handleLogin(userEmail, userPassword || user?.password || 'demo123');
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-surface-950 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-white">Cyber Recovery Hub</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold text-white">
            Enterprise Cyber Recovery
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            Automated SLA management, intelligent escalation, and executive visibility for Tier 1 banking.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {['Role-Based Access', '520+ Findings', 'SLA Engine', 'Recovery Copilot'].map((f) => (
              <div key={f} className="rounded-lg border border-surface-800 bg-surface-900/50 px-4 py-3 text-sm text-surface-300">
                {f}
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-surface-600">Development environment — enterprise SSO integration available for production</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-8 py-12">
        <div className="mx-auto w-full max-w-md">
          <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white">Sign in</h1>
          <p className="mt-2 text-sm text-surface-500">Access the Cyber Recovery Hub platform</p>

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">Email</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300">Password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {entraEnabled && (
            <div className="mt-4">
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-surface-200 dark:border-surface-800" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-surface-500 dark:bg-surface-950">or</span></div>
              </div>
              <a href="/api/auth/entra/login" className="btn-secondary w-full">
                <svg className="h-4 w-4" viewBox="0 0 21 21" fill="currentColor"><rect x="1" y="1" width="9" height="9" /><rect x="11" y="1" width="9" height="9" /><rect x="1" y="11" width="9" height="9" /><rect x="11" y="11" width="9" height="9" /></svg>
                Sign in with Microsoft Entra ID
              </a>
            </div>
          )}

          <button
            onClick={() => setShowDemo(!showDemo)}
            className="mt-6 flex w-full items-center justify-between rounded-lg border border-surface-200 p-3 text-sm text-surface-600 dark:border-surface-800 dark:text-surface-400"
          >
            <span>Quick-access accounts</span>
            <ChevronRight className={`h-4 w-4 transition-transform ${showDemo ? 'rotate-90' : ''}`} />
          </button>

          {showDemo && (
            <div className="mt-2 grid gap-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => quickLogin(u.email, u.password)}
                  disabled={loading}
                  className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 text-left transition-colors hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800"
                >
                  <User className="h-4 w-4 text-surface-400" />
                  <div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-surface-500">{u.role}</p>
                  </div>
                </button>
              ))}
              <p className="text-center text-xs text-surface-400">Dev credentials in SETUP.md — never use in production</p>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-surface-500">
            <Link href="/" className="text-brand-600 hover:underline">Back to home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
