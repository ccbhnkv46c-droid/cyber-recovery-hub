'use client';

import Image from 'next/image';
import { useState } from 'react';
import { BRAND } from '@/lib/branding';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: number;
  showText?: boolean;
  textClassName?: string;
  subtitle?: string;
  className?: string;
  priority?: boolean;
}

export function Logo({
  size = 40,
  showText = false,
  textClassName,
  subtitle,
  className,
  priority = false,
}: LogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {!imageFailed ? (
        <Image
          src={BRAND.logoPath}
          alt={BRAND.shortName}
          width={size}
          height={size}
          className="h-auto w-auto object-contain"
          style={{ maxHeight: size, maxWidth: size }}
          priority={priority}
          unoptimized
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-md bg-brand-600/10 px-2 text-brand-500"
          style={{ minHeight: size, minWidth: size }}
        >
          <span className="text-xs font-semibold">{BRAND.shortName}</span>
        </div>
      )}
      {(showText || imageFailed) && (
        <div className="min-w-0">
          <p className={cn('font-display text-sm font-bold leading-tight', textClassName)}>
            {BRAND.shortName}
          </p>
          {subtitle && (
            <p className="text-[10px] leading-tight text-surface-500">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
