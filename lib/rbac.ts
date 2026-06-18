import { UserRole } from './constants';

export type Permission =
  | 'view_all'
  | 'view_assigned'
  | 'view_team'
  | 'view_org'
  | 'create'
  | 'update'
  | 'delete'
  | 'escalate'
  | 'assign'
  | 'report'
  | 'dashboard'
  | 'update_progress'
  | 'upload_evidence'
  | 'record_blocker'
  | 'change_status'
  | 'request_exception'
  | 'approve_extension'
  | 'review_overdue'
  | 'comment'
  | 'team_performance'
  | 'sla_performance'
  | 'review_escalations'
  | 'approve_exceptions'
  | 'enterprise_dashboard'
  | 'risk_heatmap'
  | 'trends'
  | 'overdue'
  | 'org_performance'
  | 'board_dashboard'
  | 'admin'
  | 'manage_users'
  | 'manage_services'
  | 'manage_assets'
  | 'view_assets'
  | 'view_threat_intel'
  | 'manage_threat_intel'
  | 'view_risk_prioritisation'
  | 'export_risk_queue'
  | 'import'
  | 'email_outbox'
  | 'all';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SECURITY_ANALYST: ['view_all', 'view_threat_intel', 'view_risk_prioritisation', 'update', 'escalate', 'report', 'dashboard', 'comment'],
  SME: ['view_assigned', 'view_assets', 'view_threat_intel', 'view_risk_prioritisation', 'update_progress', 'upload_evidence', 'record_blocker', 'change_status', 'comment', 'dashboard'],
  ENGINEER: ['view_assigned', 'view_assets', 'view_threat_intel', 'view_risk_prioritisation', 'update_progress', 'upload_evidence', 'record_blocker', 'change_status', 'request_exception', 'comment', 'dashboard'],
  TEAM_LEADER: ['view_team', 'view_risk_prioritisation', 'approve_extension', 'review_overdue', 'comment', 'team_performance', 'dashboard'],
  ENGINEERING_MANAGER: ['view_org', 'view_risk_prioritisation', 'sla_performance', 'review_escalations', 'approve_exceptions', 'dashboard', 'comment'],
  CISO: ['enterprise_dashboard', 'risk_heatmap', 'trends', 'overdue', 'org_performance', 'view_all', 'view_threat_intel', 'view_risk_prioritisation', 'dashboard', 'report'],
  BOARD: ['board_dashboard'],
  ADMIN: ['all'],
};

export function normalizeRole(role: string): string {
  if (!role) return role;
  const upper = role.trim().toUpperCase().replace(/\s+/g, '_');
  const aliases: Record<string, string> = {
    ADMINISTRATOR: 'ADMIN',
  };
  return aliases[upper] || upper;
}

export function hasPermission(role: string, permission: Permission): boolean {
  const normalized = normalizeRole(role);
  const perms = ROLE_PERMISSIONS[normalized as UserRole];
  if (!perms) return false;
  return perms.includes('all') || perms.includes(permission);
}

export function getPermissionsForRole(role: string): Permission[] {
  const normalized = normalizeRole(role);
  if (normalized === 'ADMIN') return ['all'];
  return ROLE_PERMISSIONS[normalized as UserRole] || [];
}

export function isAssignedOnlyRole(role: string): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SME' || normalized === 'ENGINEER';
}

export function canAssignWork(role: string): boolean {
  return role === 'ADMIN';
}

export function canDeleteFinding(role: string): boolean {
  return role === 'ADMIN';
}

export function canAccessRoute(role: string, path: string): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'ADMIN') return true;

  const routePermissions: Record<string, Permission[]> = {
    '/dashboard': ['dashboard', 'enterprise_dashboard', 'board_dashboard'],
    '/completed-tasks': ['dashboard', 'view_all', 'view_assigned', 'enterprise_dashboard'],
    '/register': ['view_all', 'view_team', 'view_org'],
    '/my-actions': ['view_assigned', 'update_progress', 'dashboard'],
    '/escalations': ['review_escalations', 'view_all', 'review_overdue'],
    '/analytics': ['report', 'sla_performance', 'org_performance', 'enterprise_dashboard'],
    '/copilot': ['dashboard', 'enterprise_dashboard', 'view_all'],
    '/admin': ['admin', 'manage_users', 'email_outbox'],
    '/settings': ['dashboard', 'board_dashboard', 'view_assigned', 'enterprise_dashboard'],
    '/board': ['board_dashboard'],
    '/notifications': ['dashboard', 'board_dashboard', 'view_assigned', 'enterprise_dashboard'],
    '/findings': ['view_all', 'view_assigned', 'view_team', 'view_org'],
    '/approvals': ['approve_extension', 'approve_exceptions', 'review_overdue'],
    '/services': ['manage_services', 'view_all'],
    '/assets': ['manage_assets', 'view_assets', 'view_all'],
    '/threat-intelligence': ['manage_threat_intel', 'view_threat_intel', 'view_all'],
    '/risk-prioritisation': ['view_risk_prioritisation', 'view_all', 'view_assigned'],
    '/import': ['import', 'create'],
  };

  const base = '/' + (path.split('/').filter(Boolean)[0] || '');
  const required = routePermissions[base];
  if (!required) return true;
  return required.some((p) => hasPermission(normalized, p));
}

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

const ADMIN_NAV: NavItem[] = [
  { href: '/dashboard', label: 'Recover Dashboard', icon: 'LayoutDashboard', section: 'Overview' },
  { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle', section: 'Overview' },
  { href: '/register', label: 'Vulnerability Register', icon: 'List', section: 'Operations' },
  { href: '/import', label: 'Import Vulnerabilities', icon: 'Upload', section: 'Operations' },
  { href: '/services', label: 'Services', icon: 'Server', section: 'Operations' },
  { href: '/assets', label: 'Asset Register', icon: 'HardDrive', section: 'Operations' },
  { href: '/threat-intelligence', label: 'Threat Intelligence', icon: 'Radar', section: 'Operations' },
  { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge', section: 'Operations' },
  { href: '/escalations', label: 'Escalations', icon: 'AlertTriangle', section: 'Operations' },
  { href: '/approvals', label: 'Approvals', icon: 'CheckSquare', section: 'Operations' },
  { href: '/analytics', label: 'Reports', icon: 'BarChart3', section: 'Insights' },
  { href: '/copilot', label: 'Recover Copilot', icon: 'Bot', section: 'Insights' },
  { href: '/admin', label: 'User Management', icon: 'Building2', section: 'Administration' },
  { href: '/admin/email-outbox', label: 'Email Outbox', icon: 'Mail', section: 'Administration' },
  { href: '/notifications', label: 'Notifications', icon: 'Bell', section: 'Administration' },
  { href: '/settings', label: 'Settings', icon: 'Settings', section: 'Administration' },
];

const ROLE_NAV: Record<string, NavItem[]> = {
  BOARD: [
    { href: '/board', label: 'Board Dashboard', icon: 'LayoutDashboard' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  SME: [
    { href: '/my-actions', label: 'My Dashboard', icon: 'UserCheck' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/assets', label: 'My Assets', icon: 'HardDrive' },
    { href: '/threat-intelligence', label: 'Threat Intelligence', icon: 'Radar' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  ENGINEER: [
    { href: '/my-actions', label: 'My Dashboard', icon: 'UserCheck' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/assets', label: 'My Assets', icon: 'HardDrive' },
    { href: '/threat-intelligence', label: 'Threat Intelligence', icon: 'Radar' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  SECURITY_ANALYST: [
    { href: '/dashboard', label: 'Executive Dashboard', icon: 'LayoutDashboard' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/register', label: 'Vulnerability Register', icon: 'List' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/threat-intelligence', label: 'Threat Intelligence', icon: 'Radar' },
    { href: '/escalations', label: 'Escalations', icon: 'AlertTriangle' },
    { href: '/approvals', label: 'Approvals', icon: 'CheckSquare' },
    { href: '/analytics', label: 'Reports', icon: 'BarChart3' },
    { href: '/copilot', label: 'Recover Copilot', icon: 'Bot' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  CISO: [
    { href: '/dashboard', label: 'CISO Dashboard', icon: 'LayoutDashboard' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/register', label: 'Vulnerability Register', icon: 'List' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/threat-intelligence', label: 'Threat Intelligence', icon: 'Radar' },
    { href: '/escalations', label: 'Escalations', icon: 'AlertTriangle' },
    { href: '/analytics', label: 'Reports', icon: 'BarChart3' },
    { href: '/copilot', label: 'Recover Copilot', icon: 'Bot' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  TEAM_LEADER: [
    { href: '/dashboard', label: 'Manager Dashboard', icon: 'LayoutDashboard' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/register', label: 'Vulnerability Register', icon: 'List' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/approvals', label: 'Approvals', icon: 'CheckSquare' },
    { href: '/escalations', label: 'Escalations', icon: 'AlertTriangle' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
  ENGINEERING_MANAGER: [
    { href: '/dashboard', label: 'Manager Dashboard', icon: 'LayoutDashboard' },
    { href: '/completed-tasks', label: 'Completed Tasks', icon: 'CheckCircle' },
    { href: '/register', label: 'Vulnerability Register', icon: 'List' },
    { href: '/risk-prioritisation', label: 'Risk Prioritisation', icon: 'Gauge' },
    { href: '/approvals', label: 'Approvals', icon: 'CheckSquare' },
    { href: '/escalations', label: 'Escalations', icon: 'AlertTriangle' },
    { href: '/analytics', label: 'Reports', icon: 'BarChart3' },
    { href: '/settings', label: 'Settings', icon: 'Settings' },
  ],
};

const THREAT_INTEL_NAV: NavItem = {
  href: '/threat-intelligence',
  label: 'Threat Intelligence',
  icon: 'Radar',
  section: 'Operations',
};

function withThreatIntelNav(items: NavItem[], role: string): NavItem[] {
  if (!canAccessRoute(role, '/threat-intelligence')) return items;
  if (items.some((i) => i.href === '/threat-intelligence')) return items;
  const copy = [...items];
  const anchorIdx = copy.findIndex((i) => i.href === '/assets' || i.href === '/my-actions' || i.href === '/register');
  const insertIdx = anchorIdx >= 0 ? anchorIdx + 1 : copy.length;
  const section = copy[anchorIdx]?.section;
  copy.splice(insertIdx, 0, { ...THREAT_INTEL_NAV, ...(section ? { section } : {}) });
  return copy;
}

export function getNavForRole(role: string): NavItem[] {
  const normalized = normalizeRole(role);
  const base = normalized === 'ADMIN' ? ADMIN_NAV : ROLE_NAV[normalized] || [];
  return withThreatIntelNav(base, normalized);
}

export function getDefaultRoute(role: string): string {
  switch (role) {
    case 'BOARD': return '/board';
    case 'SME':
    case 'ENGINEER': return '/my-actions';
    case 'ADMIN': return '/dashboard';
    default: return '/dashboard';
  }
}

export function canEscalate(role: string): boolean {
  return hasPermission(role, 'escalate') || hasPermission(role, 'all');
}

export function canCreateFinding(role: string): boolean {
  return role === 'ADMIN';
}

export function canImport(role: string): boolean {
  return role === 'ADMIN';
}

export function canApprove(role: string): boolean {
  return hasPermission(role, 'approve_extension') || hasPermission(role, 'approve_exceptions') || hasPermission(role, 'all');
}

export function canViewAuditTrail(role: string): boolean {
  return role === 'ADMIN' || hasPermission(role, 'view_all');
}

export const APP_VERSION = '1.3.0';
