'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/lib/store';
import { ToastContainer } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <>
      {children}
      <ToastContainer />
    </>
  );
}
