export const ASSET_TYPES = [
  'Server',
  'Database',
  'Application',
  'Network Device',
  'Endpoint',
  'Cloud Resource',
  'Identity System',
  'Storage',
] as const;

export const ASSET_ENVIRONMENTS = ['PRODUCTION', 'TEST', 'DEVELOPMENT'] as const;

export const DATA_CLASSIFICATIONS = [
  'Public',
  'Internal',
  'Confidential',
  'Restricted',
] as const;

export const BUSINESS_CRITICALITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

export const EXPOSURE_LEVELS = ['INTERNAL', 'DMZ', 'INTERNET_FACING'] as const;

export const EXPOSURE_LABELS: Record<string, string> = {
  INTERNAL: 'Internal',
  DMZ: 'DMZ',
  INTERNET_FACING: 'Internet Facing',
};

export const ENVIRONMENT_LABELS: Record<string, string> = {
  PRODUCTION: 'Production',
  TEST: 'Test',
  DEVELOPMENT: 'Development',
};

export const CRITICALITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400',
  HIGH: 'bg-orange-500/15 text-orange-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400',
  LOW: 'bg-green-500/15 text-green-400',
};

export function deriveExposureLevel(internetFacing: boolean, environment: string): string {
  if (internetFacing && environment === 'PRODUCTION') return 'INTERNET_FACING';
  if (internetFacing) return 'DMZ';
  return 'INTERNAL';
}
