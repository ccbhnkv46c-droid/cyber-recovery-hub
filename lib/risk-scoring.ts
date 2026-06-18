import { ThreatIntelRecord } from './threat-intel';
import { FindingStatus } from './constants';

export const RISK_RATINGS = ['Low', 'Medium', 'High', 'Critical'] as const;
export type RiskRating = typeof RISK_RATINGS[number];

export const RISK_RATING_COLORS: Record<RiskRating, string> = {
  Low: 'bg-green-500/15 text-green-400',
  Medium: 'bg-yellow-500/15 text-yellow-400',
  High: 'bg-orange-500/15 text-orange-400',
  Critical: 'bg-red-500/15 text-red-400',
};

export interface RiskAssetContext {
  name?: string | null;
  businessCriticality?: string | null;
  environment?: string | null;
  internetFacing?: boolean | null;
  criticalService?: boolean | null;
  dataClassification?: string | null;
}

export interface RiskFindingInput {
  severity: string;
  cvssScore?: number;
  status: string;
  createdAt: Date | string;
  targetDate: Date | string;
  exposureLevel?: string | null;
  assetRecord?: RiskAssetContext | null;
  threatIntelligence?: ThreatIntelRecord | null;
  isOverdue?: boolean;
}

export interface RiskAssessment {
  exposureRiskScore: number;
  exposureRiskRating: RiskRating;
  exposureRiskReason: string;
  riskContributingFactors: string[];
  recommendedPriority: string;
}

const SENSITIVE_DATA = ['RESTRICTED', 'CONFIDENTIAL', 'CUSTOMER', 'REGULATED'];

function severityPoints(severity: string): number {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 25;
    case 'HIGH': return 18;
    case 'MEDIUM': return 10;
    case 'LOW': return 5;
    default: return 5;
  }
}

function assetCriticalityPoints(criticality?: string | null): number {
  switch (criticality?.toUpperCase()) {
    case 'CRITICAL': return 20;
    case 'HIGH': return 15;
    case 'MEDIUM': return 8;
    case 'LOW': return 3;
    default: return 0;
  }
}

function exposurePoints(asset: RiskAssetContext | null | undefined, exposureLevel?: string | null): number {
  if (asset?.internetFacing || exposureLevel === 'INTERNET_FACING') return 20;
  if (exposureLevel === 'DMZ') return 12;
  return 5;
}

function cvssPoints(cvssScore?: number): number {
  if (!cvssScore) return 0;
  if (cvssScore >= 9) return 10;
  if (cvssScore >= 7) return 6;
  if (cvssScore >= 4) return 3;
  return 1;
}

function findingAgeDays(createdAt: Date | string): number {
  const created = new Date(createdAt);
  return Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export function scoreToRating(score: number): RiskRating {
  if (score >= 80) return 'Critical';
  if (score >= 60) return 'High';
  if (score >= 30) return 'Medium';
  return 'Low';
}

export function calculateExposureRisk(input: RiskFindingInput): RiskAssessment {
  const factors: string[] = [];
  let score = 0;

  const sevPts = severityPoints(input.severity);
  score += sevPts;
  factors.push(`${input.severity} severity (+${sevPts})`);

  const cvssPts = cvssPoints(input.cvssScore);
  if (cvssPts) {
    score += cvssPts;
    factors.push(`CVSS ${input.cvssScore?.toFixed(1)} (+${cvssPts})`);
  }

  const asset = input.assetRecord;
  const critPts = assetCriticalityPoints(asset?.businessCriticality);
  if (critPts) {
    score += critPts;
    factors.push(`${asset?.businessCriticality} asset criticality (+${critPts})`);
  }

  const expPts = exposurePoints(asset, input.exposureLevel);
  score += expPts;
  if (asset?.internetFacing || input.exposureLevel === 'INTERNET_FACING') {
    factors.push(`Internet-facing exposure (+${expPts})`);
  } else if (input.exposureLevel === 'DMZ') {
    factors.push(`DMZ exposure (+${expPts})`);
  } else {
    factors.push(`Internal exposure (+${expPts})`);
  }

  const threat = input.threatIntelligence;
  if (threat) {
    if (threat.activeExploitation) {
      score += 25;
      factors.push('Active exploitation reported (+25)');
    }
    if (threat.publicExploitAvailable) {
      score += 15;
      factors.push('Public exploit available (+15)');
    }
    if (threat.ransomwareAssociated) {
      score += 20;
      factors.push('Ransomware association (+20)');
    }
    if (threat.malwareAssociated) {
      score += 10;
      factors.push('Malware association (+10)');
    }
    if (threat.threatActorAssociated) {
      score += 10;
      factors.push('Threat actor association (+10)');
    }
  }

  if (asset?.environment === 'PRODUCTION') {
    score += 15;
    factors.push('Production environment (+15)');
  }
  if (asset?.criticalService) {
    score += 15;
    factors.push('Critical service (+15)');
  }
  const dataClass = asset?.dataClassification?.toUpperCase() || '';
  if (SENSITIVE_DATA.some((d) => dataClass.includes(d))) {
    score += 15;
    factors.push(`Sensitive data classification: ${asset?.dataClassification} (+15)`);
  }

  if (input.isOverdue) {
    score += 15;
    factors.push('SLA breached (+15)');
  }

  const ageDays = findingAgeDays(input.createdAt);
  if (ageDays > 90) {
    score += 15;
    factors.push(`Finding age ${ageDays} days (+15)`);
  } else if (ageDays > 30) {
    score += 8;
    factors.push(`Finding age ${ageDays} days (+8)`);
  }

  if (input.status === 'BLOCKED') {
    score += 10;
    factors.push('Blocked remediation status (+10)');
  }

  score = Math.min(100, score);
  const exposureRiskRating = scoreToRating(score);

  const reasonParts: string[] = [];
  if (exposureRiskRating === 'Critical' || exposureRiskRating === 'High') {
    reasonParts.push(`This finding is rated ${exposureRiskRating}`);
  } else {
    reasonParts.push(`This finding is rated ${exposureRiskRating}`);
  }

  const contextBits: string[] = [];
  if (asset?.internetFacing || input.exposureLevel === 'INTERNET_FACING') {
    contextBits.push('an internet-facing');
  }
  if (asset?.environment === 'PRODUCTION') contextBits.push('production');
  if (asset?.criticalService) contextBits.push('critical service');
  if (asset?.name) {
    contextBits.push(`asset ${asset.name}`);
  } else if (asset) {
    contextBits.push('asset');
  }
  if (contextBits.length) {
    reasonParts.push(`because it affects ${contextBits.join(' ')}`);
  }
  if (threat?.activeExploitation) reasonParts.push('has active exploitation reported');
  if (input.isOverdue) reasonParts.push('is currently overdue');

  const exposureRiskReason = reasonParts.join(', ').replace(', because', ' because') + '.';

  const recommendedPriority =
    exposureRiskRating === 'Critical' ? 'Immediate remediation required'
      : exposureRiskRating === 'High' ? 'Prioritise within current sprint'
        : exposureRiskRating === 'Medium' ? 'Schedule remediation within SLA'
          : 'Monitor and remediate per standard queue';

  return {
    exposureRiskScore: score,
    exposureRiskRating,
    exposureRiskReason,
    riskContributingFactors: factors,
    recommendedPriority,
  };
}

export function matchesRiskRating(score: number, rating: string): boolean {
  return scoreToRating(score) === rating;
}
