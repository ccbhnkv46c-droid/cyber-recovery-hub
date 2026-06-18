import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  canAccessRoute,
  getNavForRole,
  getDefaultRoute,
  canEscalate,
  canAssignWork,
  isAssignedOnlyRole,
  canCreateFinding,
} from '../lib/rbac';

describe('RBAC', () => {
  it('grants SECURITY_ANALYST view_all but not assign', () => {
    expect(hasPermission('SECURITY_ANALYST', 'view_all')).toBe(true);
    expect(hasPermission('SECURITY_ANALYST', 'escalate')).toBe(true);
    expect(hasPermission('SECURITY_ANALYST', 'assign')).toBe(false);
  });

  it('restricts SME to assigned findings only', () => {
    expect(hasPermission('SME', 'view_assigned')).toBe(true);
    expect(hasPermission('SME', 'view_all')).toBe(false);
    expect(hasPermission('SME', 'assign')).toBe(false);
    expect(hasPermission('SME', 'create')).toBe(false);
    expect(isAssignedOnlyRole('SME')).toBe(true);
  });

  it('restricts ENGINEER to assigned findings only', () => {
    expect(hasPermission('ENGINEER', 'view_assigned')).toBe(true);
    expect(hasPermission('ENGINEER', 'view_all')).toBe(false);
    expect(hasPermission('ENGINEER', 'escalate')).toBe(false);
    expect(isAssignedOnlyRole('ENGINEER')).toBe(true);
  });

  it('grants BOARD only board_dashboard', () => {
    expect(hasPermission('BOARD', 'board_dashboard')).toBe(true);
    expect(hasPermission('BOARD', 'view_all')).toBe(false);
    expect(hasPermission('BOARD', 'admin')).toBe(false);
  });

  it('ADMIN has all permissions and can assign', () => {
    expect(hasPermission('ADMIN', 'admin')).toBe(true);
    expect(hasPermission('ADMIN', 'assign')).toBe(true);
    expect(canAssignWork('ADMIN')).toBe(true);
    expect(canCreateFinding('ADMIN')).toBe(true);
  });

  it('only ADMIN can assign work', () => {
    expect(canAssignWork('ADMIN')).toBe(true);
    expect(canAssignWork('SECURITY_ANALYST')).toBe(false);
    expect(canAssignWork('SME')).toBe(false);
  });

  it('blocks SME from register and import routes', () => {
    expect(canAccessRoute('SME', '/register')).toBe(false);
    expect(canAccessRoute('SME', '/import')).toBe(false);
    expect(canAccessRoute('SME', '/admin')).toBe(false);
    expect(canAccessRoute('SME', '/my-actions')).toBe(true);
    expect(canAccessRoute('SME', '/findings/CRH-00001')).toBe(true);
  });

  it('blocks BOARD from register route', () => {
    expect(canAccessRoute('BOARD', '/register')).toBe(false);
    expect(canAccessRoute('BOARD', '/board')).toBe(true);
    expect(canAccessRoute('BOARD', '/settings')).toBe(true);
  });

  it('allows ADMIN to access all management routes', () => {
    expect(canAccessRoute('ADMIN', '/register')).toBe(true);
    expect(canAccessRoute('ADMIN', '/import')).toBe(true);
    expect(canAccessRoute('ADMIN', '/services')).toBe(true);
    expect(canAccessRoute('ADMIN', '/threat-intelligence')).toBe(true);
    expect(canAccessRoute('ADMIN', '/admin')).toBe(true);
    expect(canAccessRoute('ADMIN', '/admin/email-outbox')).toBe(true);
  });

  it('allows SME read-only access to threat intelligence', () => {
    expect(canAccessRoute('SME', '/threat-intelligence')).toBe(true);
    expect(hasPermission('SME', 'view_threat_intel')).toBe(true);
    expect(hasPermission('SME', 'manage_threat_intel')).toBe(false);
  });

  it('returns full admin navigation', () => {
    const adminNav = getNavForRole('ADMIN');
    expect(adminNav.length).toBeGreaterThanOrEqual(10);
    expect(adminNav.some((n) => n.href === '/import')).toBe(true);
    expect(adminNav.some((n) => n.href === '/services')).toBe(true);
    expect(adminNav.some((n) => n.href === '/threat-intelligence')).toBe(true);
    expect(adminNav.some((n) => n.href === '/admin/email-outbox')).toBe(true);
    expect(adminNav.some((n) => n.href === '/dashboard')).toBe(true);
  });

  it('returns role-appropriate nav items for SME', () => {
    const smeNav = getNavForRole('SME');
    expect(smeNav.some((n) => n.href === '/my-actions')).toBe(true);
    expect(smeNav.some((n) => n.href === '/threat-intelligence')).toBe(true);
    expect(smeNav.some((n) => n.href === '/register')).toBe(false);
    expect(smeNav.some((n) => n.href === '/import')).toBe(false);
  });

  it('returns correct default routes', () => {
    expect(getDefaultRoute('BOARD')).toBe('/board');
    expect(getDefaultRoute('SME')).toBe('/my-actions');
    expect(getDefaultRoute('ENGINEER')).toBe('/my-actions');
    expect(getDefaultRoute('ADMIN')).toBe('/dashboard');
    expect(getDefaultRoute('CISO')).toBe('/dashboard');
  });

  it('canEscalate only for analyst and admin', () => {
    expect(canEscalate('SECURITY_ANALYST')).toBe(true);
    expect(canEscalate('SME')).toBe(false);
    expect(canEscalate('ADMIN')).toBe(true);
  });
});
