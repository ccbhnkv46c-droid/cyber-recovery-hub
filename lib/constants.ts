export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type FindingStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'PENDING_REVIEW'
  | 'PENDING_EXCEPTION'
  | 'RISK_ACCEPTED'
  | 'AWAITING_CHANGE'
  | 'AWAITING_APPROVAL'
  | 'REMEDIATED'
  | 'CLOSED'
  | 'COMPLETED';
export type EscalationLevel = 'NONE' | 'ENGINEER_REMINDER' | 'ENGINEER_REMINDER_2' | 'TEAM_LEADER' | 'ENGINEERING_MANAGER' | 'HEAD_OF_TECHNOLOGY' | 'CISO' | 'BOARD';
export type UserRole = 'SECURITY_ANALYST' | 'ENGINEER' | 'SME' | 'TEAM_LEADER' | 'ENGINEERING_MANAGER' | 'CISO' | 'BOARD' | 'ADMIN';

export const SLA_DAYS: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 15,
  MEDIUM: 30,
  LOW: 90,
};

export function calculateTargetDate(severity: Severity, createdAt: Date = new Date()): Date {
  const days = SLA_DAYS[severity];
  const target = new Date(createdAt);
  target.setDate(target.getDate() + days);
  return target;
}

export function getDaysRemaining(targetDate: Date): number {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export type SlaStatus = 'green' | 'amber' | 'red' | 'overdue';

export function getSlaStatus(targetDate: Date, severity: Severity): SlaStatus {
  const daysRemaining = getDaysRemaining(targetDate);
  if (daysRemaining < 0) return 'overdue';
  const totalDays = SLA_DAYS[severity];
  const percentRemaining = daysRemaining / totalDays;
  if (percentRemaining > 0.5) return 'green';
  if (percentRemaining > 0.25) return 'amber';
  return 'red';
}

export function calculateRiskScore(params: {
  cvssScore: number;
  exploitability: number;
  likelihood: number;
  exposure: number;
  criticality: number;
  businessImpactWeight?: number;
}): {
  technicalRisk: number;
  businessRisk: number;
  recoveryScore: number;
  riskLevel: string;
} {
  const { cvssScore, exploitability, likelihood, exposure, criticality } = params;
  const technicalRisk = Math.min(100, (cvssScore * 10 + exploitability * 15 + exposure * 10) / 3);
  const businessRisk = Math.min(100, (likelihood * 20 + criticality * 25 + cvssScore * 5) / 3);
  const recoveryScore = Math.min(100, (technicalRisk * 0.6 + businessRisk * 0.4));

  let riskLevel = 'Low';
  if (recoveryScore >= 80) riskLevel = 'Critical';
  else if (recoveryScore >= 60) riskLevel = 'High';
  else if (recoveryScore >= 40) riskLevel = 'Medium';

  return { technicalRisk, businessRisk, recoveryScore, riskLevel };
}

export const ESCALATION_WORKFLOW: EscalationLevel[] = [
  'NONE',
  'ENGINEER_REMINDER',
  'ENGINEER_REMINDER_2',
  'TEAM_LEADER',
  'ENGINEERING_MANAGER',
  'HEAD_OF_TECHNOLOGY',
  'CISO',
  'BOARD',
];

export function getNextEscalationLevel(current: EscalationLevel): EscalationLevel {
  const idx = ESCALATION_WORKFLOW.indexOf(current);
  if (idx < 0 || idx >= ESCALATION_WORKFLOW.length - 1) return current;
  return ESCALATION_WORKFLOW[idx + 1];
}

export function generateEscalationMessage(
  level: EscalationLevel,
  findingId: string,
  title: string,
  ownerName: string
): string {
  const messages: Record<EscalationLevel, string> = {
    NONE: '',
    ENGINEER_REMINDER: `Reminder: Finding ${findingId} "${title}" requires your attention. Please update remediation progress.`,
    ENGINEER_REMINDER_2: `Second reminder: Finding ${findingId} "${title}" is approaching SLA deadline. Immediate action required.`,
    TEAM_LEADER: `Escalation to Team Leader: Finding ${findingId} "${title}" assigned to ${ownerName} is overdue for remediation.`,
    ENGINEERING_MANAGER: `Escalation to Engineering Manager: Finding ${findingId} "${title}" has exceeded SLA. Team intervention required.`,
    HEAD_OF_TECHNOLOGY: `Escalation to Head of Technology: Critical finding ${findingId} "${title}" requires executive attention.`,
    CISO: `CISO Alert: Finding ${findingId} "${title}" has reached maximum escalation level. Enterprise risk exposure.`,
    BOARD: `Board Notification: Critical recover item ${findingId} requires governance visibility.`,
  };
  return messages[level] || '';
}

export const CLOSED_STATUSES: FindingStatus[] = ['REMEDIATED', 'CLOSED', 'COMPLETED'];

export const ACTIVE_STATUSES: FindingStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'BLOCKED',
  'PENDING_REVIEW',
  'PENDING_EXCEPTION',
  'RISK_ACCEPTED',
  'AWAITING_CHANGE',
  'AWAITING_APPROVAL',
];

export function isClosedStatus(status: string): boolean {
  return CLOSED_STATUSES.includes(status as FindingStatus);
}

export function isOverdue(targetDate: Date, status: string): boolean {
  if (!ACTIVE_STATUSES.includes(status as FindingStatus)) return false;
  return getDaysRemaining(targetDate) < 0;
}

export function getSlaBucket(targetDate: Date, status: string): 'within' | 'dueSoon' | 'overdue' {
  if (!ACTIVE_STATUSES.includes(status as FindingStatus)) return 'within';
  const days = getDaysRemaining(targetDate);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'dueSoon';
  return 'within';
}

export function calcMttrDays(findings: { createdAt: Date; closedAt: Date | null }[]): number {
  const closed = findings.filter((f) => f.closedAt);
  if (!closed.length) return 0;
  const total = closed.reduce(
    (sum, f) => sum + (f.closedAt!.getTime() - f.createdAt.getTime()) / 86400000,
    0
  );
  return Math.round(total / closed.length);
}

export const ROLE_PERMISSIONS = {
  SECURITY_ANALYST: ['view_all', 'create', 'update', 'escalate', 'assign', 'report', 'dashboard'],
  ENGINEER: ['view_assigned', 'update_progress', 'upload_evidence', 'record_blocker', 'change_status', 'request_exception'],
  TEAM_LEADER: ['view_team', 'approve_extension', 'review_overdue', 'comment', 'team_performance'],
  ENGINEERING_MANAGER: ['view_org', 'sla_performance', 'review_escalations', 'approve_exceptions'],
  CISO: ['enterprise_dashboard', 'risk_heatmap', 'trends', 'overdue', 'org_performance'],
  BOARD: ['board_dashboard'],
  ADMIN: ['all'],
} as const;
