import { cn, severityColor, statusColor } from '@/lib/utils';
import { THREAT_PRIORITY_COLORS, THREAT_PRIORITY_LABELS, ThreatPriority } from '@/lib/threat-intel';
import { RISK_RATING_COLORS, RiskRating } from '@/lib/risk-scoring';

export function SeverityBadge({ severity }: { severity: string }) {
  return <span className={cn('badge', severityColor(severity))}>{severity}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', statusColor(status))}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ThreatPriorityBadge({ priority }: { priority: ThreatPriority | string | null | undefined }) {
  if (!priority) return null;
  const p = priority as ThreatPriority;
  return (
    <span className={cn('badge border', THREAT_PRIORITY_COLORS[p] || THREAT_PRIORITY_COLORS.NORMAL)}>
      {THREAT_PRIORITY_LABELS[p] || priority}
    </span>
  );
}

export function ThreatIntelBadge({ matched }: { matched?: boolean }) {
  if (!matched) return null;
  return <span className="badge bg-purple-500/15 text-purple-400">Threat Intel</span>;
}

export function RiskRatingBadge({ rating, score }: { rating?: RiskRating | string | null; score?: number | null }) {
  if (!rating) return null;
  const r = rating as RiskRating;
  return (
    <span className={cn('badge', RISK_RATING_COLORS[r] || RISK_RATING_COLORS.Low)}>
      {score != null ? `${rating} (${score})` : rating}
    </span>
  );
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = 'brand',
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    brand: 'from-brand-500/20 to-brand-600/5 text-brand-500',
    red: 'from-red-500/20 to-red-600/5 text-red-500',
    orange: 'from-orange-500/20 to-orange-600/5 text-orange-500',
    yellow: 'from-yellow-500/20 to-yellow-600/5 text-yellow-500',
    green: 'from-green-500/20 to-green-600/5 text-green-500',
  };

  return (
    <div className="card-hover animate-slide-up">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400">{title}</p>
          <p className="mt-2 font-display text-3xl font-bold text-surface-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-surface-500">{subtitle}</p>}
          {trend && (
            <p className={cn('mt-2 text-xs font-medium', trend.value >= 0 ? 'text-green-500' : 'text-red-500')}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-xl bg-gradient-to-br p-3', colorMap[color])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-surface-900 dark:text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-surface-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-surface-500">
      <p className="text-sm">{message}</p>
    </div>
  );
}
