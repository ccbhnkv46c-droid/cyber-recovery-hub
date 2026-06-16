import Image from 'next/image';
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
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Image
        src={BRAND.logoPath}
        alt={BRAND.shortName}
        width={size}
        height={size}
        className="h-auto w-auto object-contain"
        style={{ maxHeight: size, maxWidth: size }}
        priority={priority}
      />
      {showText && (
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
