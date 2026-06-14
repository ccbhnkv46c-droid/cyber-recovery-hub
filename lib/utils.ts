import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
    HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    MEDIUM: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    LOW: 'bg-green-500/15 text-green-400 border-green-500/30',
  };
  return map[severity] || 'bg-surface-700 text-surface-300';
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    IN_PROGRESS: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    BLOCKED: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    PENDING_REVIEW: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    PENDING_EXCEPTION: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    RISK_ACCEPTED: 'bg-surface-500/15 text-surface-400 border-surface-500/30',
    REMEDIATED: 'bg-green-500/15 text-green-400 border-green-500/30',
    CLOSED: 'bg-surface-600/15 text-surface-300 border-surface-600/30',
  };
  return map[status] || 'bg-surface-700 text-surface-300';
}

export function slaStatusColor(status: string): string {
  const map: Record<string, string> = {
    green: 'text-green-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    overdue: 'text-red-500 animate-pulse-red',
  };
  return map[status] || 'text-surface-400';
}

export function escalationLabel(level: string): string {
  const map: Record<string, string> = {
    NONE: 'None',
    ENGINEER_REMINDER: 'Engineer Reminder',
    ENGINEER_REMINDER_2: '2nd Reminder',
    TEAM_LEADER: 'Team Leader',
    ENGINEERING_MANAGER: 'Eng. Manager',
    HEAD_OF_TECHNOLOGY: 'Head of Tech',
    CISO: 'CISO',
    BOARD: 'Board',
  };
  return map[level] || level;
}
