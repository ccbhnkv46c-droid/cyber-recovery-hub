import { describe, it, expect } from 'vitest';
import { calculateExposureRisk, scoreToRating } from '../lib/risk-scoring';

describe('Risk Scoring Engine', () => {
  it('maps scores to correct ratings', () => {
    expect(scoreToRating(0)).toBe('Low');
    expect(scoreToRating(29)).toBe('Low');
    expect(scoreToRating(30)).toBe('Medium');
    expect(scoreToRating(59)).toBe('Medium');
    expect(scoreToRating(60)).toBe('High');
    expect(scoreToRating(79)).toBe('High');
    expect(scoreToRating(80)).toBe('Critical');
    expect(scoreToRating(100)).toBe('Critical');
  });

  it('caps score at 100', () => {
    const result = calculateExposureRisk({
      severity: 'CRITICAL',
      cvssScore: 10,
      status: 'BLOCKED',
      createdAt: new Date(Date.now() - 120 * 86400000),
      targetDate: new Date(Date.now() - 30 * 86400000),
      exposureLevel: 'INTERNET_FACING',
      isOverdue: true,
      assetRecord: {
        businessCriticality: 'CRITICAL',
        environment: 'PRODUCTION',
        internetFacing: true,
        criticalService: true,
        dataClassification: 'RESTRICTED',
      },
      threatIntelligence: {
        id: 'test-1',
        cve: 'CVE-TEST',
        threatName: 'Test',
        threatSource: 'Test',
        activeExploitation: true,
        publicExploitAvailable: true,
        ransomwareAssociated: true,
        malwareAssociated: true,
        threatActorAssociated: 'APT',
        exploitMaturity: 'WEAPONIZED',
        intelligenceConfidence: 'HIGH',
        sourceReference: null,
        recommendedAction: null,
        dateFirstSeen: null,
        lastUpdated: new Date(),
      },
    });
    expect(result.exposureRiskScore).toBeLessThanOrEqual(100);
    expect(result.exposureRiskRating).toBe('Critical');
    expect(result.exposureRiskReason).toContain('Critical');
    expect(result.riskContributingFactors.length).toBeGreaterThan(5);
  });

  it('scores high CVSS lower than critical business context', () => {
    const highCvssLowBusiness = calculateExposureRisk({
      severity: 'CRITICAL',
      cvssScore: 9.8,
      status: 'OPEN',
      createdAt: new Date(),
      targetDate: new Date(Date.now() + 30 * 86400000),
      exposureLevel: 'INTERNAL',
      assetRecord: {
        businessCriticality: 'LOW',
        environment: 'DEVELOPMENT',
        internetFacing: false,
        criticalService: false,
        dataClassification: 'Internal',
      },
      threatIntelligence: null,
      isOverdue: false,
    });

    const mediumCvssCriticalBusiness = calculateExposureRisk({
      severity: 'MEDIUM',
      cvssScore: 5.4,
      status: 'OPEN',
      createdAt: new Date(),
      targetDate: new Date(Date.now() + 30 * 86400000),
      exposureLevel: 'INTERNET_FACING',
      assetRecord: {
        businessCriticality: 'CRITICAL',
        environment: 'PRODUCTION',
        internetFacing: true,
        criticalService: true,
        dataClassification: 'CUSTOMER',
      },
      threatIntelligence: null,
      isOverdue: false,
    });

    expect(mediumCvssCriticalBusiness.exposureRiskScore).toBeGreaterThan(highCvssLowBusiness.exposureRiskScore);
  });
});
