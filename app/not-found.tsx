import Link from 'next/link';
import { BRAND } from '@/lib/branding';
import { Logo } from '@/components/branding/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 px-6 dark:bg-surface-950">
      <Logo size={64} className="mb-6" priority />
      <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white">Page not found</h1>
      <p className="mt-2 max-w-md text-center text-sm text-surface-500">
        The page you requested does not exist in {BRAND.shortName}.
      </p>
      <Link href="/" className="btn-primary mt-8">
        Return to {BRAND.shortName}
      </Link>
    </div>
  );
}
