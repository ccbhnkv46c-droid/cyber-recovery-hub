import { Suspense } from 'react';
import LoginCallbackClient from './client';

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Signing in...</div>}>
      <LoginCallbackClient />
    </Suspense>
  );
}
