import { describe, it, expect } from 'vitest';
import {
  SLA_DAYS,
  calculateTargetDate,
  getDaysRemaining,
  getSlaStatus,
  isOverdue,
  isClosedStatus,
  getSlaBucket,
  calculateRiskScore,
  getNextEscalationLevel,
  generateEscalationMessage,
} from '../lib/constants';

describe('SLA Engine', () => {
  it('defines correct SLA days per severity', () => {
    expect(SLA_DAYS.CRITICAL).toBe(5);
    expect(SLA_DAYS.HIGH).toBe(15);
    expect(SLA_DAYS.MEDIUM).toBe(30);
    expect(SLA_DAYS.LOW).toBe(90);
  });

  it('calculates target date from severity', () => {
    const created = new Date('2026-01-01');
    const target = calculateTargetDate('CRITICAL', created);
    expect(target.getDate()).toBe(6);
  });

  it('returns overdue status when past target', () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(getSlaStatus(past, 'HIGH')).toBe('overdue');
    expect(isOverdue(past, 'OPEN')).toBe(true);
  });

  it('returns green when plenty of time remains', () => {
    const future = new Date();
    future.setDate(future.getDate() + 80);
    expect(getSlaStatus(future, 'LOW')).toBe('green');
  });

  it('does not mark closed findings as overdue', () => {
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(isOverdue(past, 'CLOSED')).toBe(false);
    expect(isOverdue(past, 'COMPLETED')).toBe(false);
  });

  it('identifies closed statuses', () => {
    expect(isClosedStatus('COMPLETED')).toBe(true);
    expect(isClosedStatus('REMEDIATED')).toBe(true);
    expect(isClosedStatus('OPEN')).toBe(false);
    const past = new Date();
    past.setDate(past.getDate() - 10);
    expect(getSlaBucket(past, 'OPEN')).toBe('overdue');
  });
});

describe('Risk Scoring', () => {
  it('calculates recovery score and risk level', () => {
    const result = calculateRiskScore({
      cvssScore: 9.5,
      exploitability: 9,
      likelihood: 8,
      exposure: 7,
      criticality: 9,
    });
    expect(result.recoveryScore).toBeGreaterThan(60);
    expect(['High', 'Critical']).toContain(result.riskLevel);
  });

  it('returns Low risk for low scores', () => {
    const result = calculateRiskScore({
      cvssScore: 2,
      exploitability: 2,
      likelihood: 2,
      exposure: 2,
      criticality: 2,
    });
    expect(result.riskLevel).toBe('Low');
  });
});

describe('Escalation Engine', () => {
  it('progresses through escalation workflow', () => {
    expect(getNextEscalationLevel('NONE')).toBe('ENGINEER_REMINDER');
    expect(getNextEscalationLevel('ENGINEER_REMINDER')).toBe('ENGINEER_REMINDER_2');
    expect(getNextEscalationLevel('TEAM_LEADER')).toBe('ENGINEERING_MANAGER');
    expect(getNextEscalationLevel('BOARD')).toBe('BOARD');
  });

  it('generates escalation messages with finding details', () => {
    const msg = generateEscalationMessage('CISO', 'CRH-00001', 'SQL Injection', 'James Wilson');
    expect(msg).toContain('CRH-00001');
    expect(msg).toContain('CISO');
    expect(msg).toContain('SQL Injection');
  });
});
