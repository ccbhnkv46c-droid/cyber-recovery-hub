export const TASK_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'AWAITING_CHANGE',
  'BLOCKED',
  'AWAITING_APPROVAL',
  'RISK_ACCEPTED',
  'COMPLETED',
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  AWAITING_CHANGE: 'Awaiting Change',
  BLOCKED: 'Blocked',
  AWAITING_APPROVAL: 'Awaiting Approval',
  RISK_ACCEPTED: 'Risk Accepted',
  COMPLETED: 'Completed',
  PENDING_REVIEW: 'Awaiting Change',
  PENDING_EXCEPTION: 'Awaiting Approval',
  REMEDIATED: 'Completed',
  CLOSED: 'Completed',
};

export const ACTIVITY_TYPES = {
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  COMMENT: 'COMMENT',
  NEXT_STEP: 'NEXT_STEP',
  BLOCKER: 'BLOCKER',
  PROGRESS_UPDATE: 'PROGRESS_UPDATE',
  STATUS_CHANGE: 'STATUS_CHANGE',
  EVIDENCE: 'EVIDENCE',
  MANAGER_COMMENT: 'MANAGER_COMMENT',
  RECOVERY_REVIEW: 'RECOVERY_REVIEW',
  COMPLETED: 'COMPLETED',
  IMPORTED: 'IMPORTED',
  BULK_ASSIGNED: 'BULK_ASSIGNED',
} as const;

export const DEFAULT_SERVICES = [
  { name: 'SailPoint ISC', businessArea: 'Identity', criticality: 'HIGH' },
  { name: 'Active Directory', businessArea: 'Identity', criticality: 'CRITICAL' },
  { name: 'Entra ID', businessArea: 'Identity', criticality: 'CRITICAL' },
  { name: 'CyberArk', businessArea: 'Identity', criticality: 'CRITICAL' },
  { name: 'Microsoft 365', businessArea: 'Collaboration', criticality: 'HIGH' },
  { name: 'Exchange', businessArea: 'Collaboration', criticality: 'HIGH' },
  { name: 'Linux', businessArea: 'Infrastructure', criticality: 'MEDIUM' },
  { name: 'Windows', businessArea: 'Infrastructure', criticality: 'MEDIUM' },
  { name: 'Networks', businessArea: 'Infrastructure', criticality: 'HIGH' },
  { name: 'AWS', businessArea: 'Cloud', criticality: 'HIGH' },
  { name: 'Azure', businessArea: 'Cloud', criticality: 'HIGH' },
];

export function normalizeStatus(status: string): string {
  const map: Record<string, string> = {
    'Open': 'OPEN', 'In Progress': 'IN_PROGRESS', 'In_Progress': 'IN_PROGRESS',
    'Awaiting Change': 'AWAITING_CHANGE', 'Blocked': 'BLOCKED',
    'Awaiting Approval': 'AWAITING_APPROVAL', 'Risk Accepted': 'RISK_ACCEPTED',
    'Completed': 'COMPLETED', 'Remediated': 'COMPLETED', 'Closed': 'COMPLETED',
  };
  return map[status] || status.toUpperCase().replace(/\s/g, '_');
}

export function normalizeSeverity(sev: string): string {
  const s = sev.toUpperCase().trim();
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(s)) return s;
  if (s.startsWith('CRIT')) return 'CRITICAL';
  if (s.startsWith('MED')) return 'MEDIUM';
  return 'MEDIUM';
}
