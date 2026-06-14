'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore, useDebugStore } from '@/lib/store';
import { getPermissionsForRole, APP_VERSION } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function DebugPanel() {
  const [open, setOpen] = useState(true);
  const { user } = useAuthStore();
  const { lastApiCall, lastApiMethod } = useDebugStore();
  const pathname = usePathname();

  if (process.env.NODE_ENV === 'production') return null;

  const permissions = user?.role ? getPermissionsForRole(user.role) : [];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-amber-500/40 bg-surface-900/95 text-xs text-surface-200 shadow-xl backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-amber-400"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Bug className="h-3.5 w-3.5" /> Dev Debug Panel v{APP_VERSION}
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-amber-500/20 px-3 py-2">
          <Row label="User" value={user?.name || '—'} />
          <Row label="Email" value={user?.email || '—'} />
          <Row label="Role" value={user?.role || '—'} highlight={user?.role === 'ADMIN'} />
          <Row label="Route" value={pathname} />
          <Row label="API" value={`${lastApiMethod} ${lastApiCall}`} />
          <div>
            <p className="mb-1 text-surface-500">Permissions</p>
            <p className={cn('font-mono text-[10px] leading-relaxed', user?.role === 'ADMIN' ? 'text-green-400' : 'text-surface-400')}>
              {permissions.join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-surface-500">{label}</span>
      <span className={cn('truncate text-right font-mono', highlight && 'font-bold text-green-400')}>{value}</span>
    </div>
  );
}
