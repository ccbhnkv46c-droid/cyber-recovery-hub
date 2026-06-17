export const EXPLOIT_MATURITY_LEVELS = ['UNPROVEN', 'POC', 'FUNCTIONAL', 'HIGH', 'WEAPONIZED'] as const;
export const INTELLIGENCE_CONFIDENCE_LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const;
export const THREAT_PRIORITY_LEVELS = ['CRITICAL', 'HIGH', 'NORMAL'] as const;

export type ThreatPriority = typeof THREAT_PRIORITY_LEVELS[number];

export const THREAT_PRIORITY_LABELS: Record<ThreatPriority, string> = {
  CRITICAL: 'Critical Threat Priority',
  HIGH: 'High Threat Priority',
  NORMAL: 'Normal Threat Priority',
};

export const THREAT_PRIORITY_COLORS: Record<ThreatPriority, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  NORMAL: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
};

export const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'bg-green-500/15 text-green-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400',
  LOW: 'bg-surface-500/15 text-surface-400',
};

export interface ThreatIntelRecord {
  id: string;
  cve: string;
  threatName: string;
  threatSource: string;
  activeExploitation: boolean;
  publicExploitAvailable: boolean;
  ransomwareAssociated: boolean;
  malwareAssociated: boolean;
  threatActorAssociated: string | null;
  exploitMaturity: string | null;
  dateFirstSeen: Date | string | null;
  intelligenceConfidence: string;
  sourceReference: string | null;
  recommendedAction: string | null;
  lastUpdated: Date | string;
}

export interface AssetContext {
  businessCriticality?: string | null;
  environment?: string | null;
  internetFacing?: boolean | null;
}

export function normalizeCve(cve: string | null | undefined): string | null {
  if (!cve?.trim()) return null;
  return cve.trim().toUpperCase();
}

export function computeThreatPriority(
  threat: ThreatIntelRecord | null | undefined,
  asset?: AssetContext | null,
): ThreatPriority | null {
  if (!threat) return null;

  const isCriticalAsset = asset?.businessCriticality === 'CRITICAL';
  const isProduction = asset?.environment === 'PRODUCTION';
  const isInternetFacing = asset?.internetFacing === true;

  if (threat.activeExploitation && isCriticalAsset) return 'CRITICAL';
  if (threat.ransomwareAssociated && isProduction) return 'CRITICAL';
  if (threat.publicExploitAvailable && isInternetFacing) return 'HIGH';
  return 'NORMAL';
}

export const DEMO_THREAT_INTELLIGENCE = [
  {
    cve: 'CVE-2024-3400',
    threatName: 'PAN-OS Command Injection (Operation MidnightEclipse)',
    threatSource: 'CISA KEV / Palo Alto Unit 42',
    activeExploitation: true,
    publicExploitAvailable: true,
    ransomwareAssociated: false,
    malwareAssociated: true,
    threatActorAssociated: 'UNC5537',
    exploitMaturity: 'WEAPONIZED',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    recommendedAction: 'Apply Palo Alto hotfix immediately. Restrict GlobalProtect portal exposure. Hunt for webshell activity.',
  },
  {
    cve: 'CVE-2023-4966',
    threatName: 'Citrix Bleed Session Token Leak',
    threatSource: 'Mandiant / CISA',
    activeExploitation: true,
    publicExploitAvailable: true,
    ransomwareAssociated: true,
    malwareAssociated: true,
    threatActorAssociated: 'LockBit affiliates',
    exploitMaturity: 'WEAPONIZED',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://www.mandiant.com/resources/blog/citrix-bleed-session-hijacking',
    recommendedAction: 'Patch NetScaler ADC/Gateway. Invalidate all active sessions. Review VPN logs for lateral movement.',
  },
  {
    cve: 'CVE-2021-44228',
    threatName: 'Apache Log4j Remote Code Execution (Log4Shell)',
    threatSource: 'NCSC-UK / CISA',
    activeExploitation: true,
    publicExploitAvailable: true,
    ransomwareAssociated: true,
    malwareAssociated: true,
    threatActorAssociated: 'Multiple ransomware groups',
    exploitMaturity: 'WEAPONIZED',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://www.ncsc.gov.uk/news/apache-log4j-vulnerability',
    recommendedAction: 'Upgrade Log4j to 2.17.1+. Scan estate for vulnerable Java components. Block outbound LDAP/RMI.',
  },
  {
    cve: 'CVE-2023-23397',
    threatName: 'Microsoft Outlook Elevation of Privilege',
    threatSource: 'Microsoft MSRC / NSA',
    activeExploitation: true,
    publicExploitAvailable: false,
    ransomwareAssociated: false,
    malwareAssociated: false,
    threatActorAssociated: 'APT28 (Fancy Bear)',
    exploitMaturity: 'FUNCTIONAL',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://msrc.microsoft.com/update-guide/vulnerability/CVE-2023-23397',
    recommendedAction: 'Apply March 2023 security update. Audit Exchange/Outlook NTLM relay exposure. Hunt for suspicious calendar invites.',
  },
  {
    cve: 'CVE-2024-3094',
    threatName: 'XZ Utils Supply Chain Backdoor',
    threatSource: 'OpenSSF / CISA',
    activeExploitation: false,
    publicExploitAvailable: true,
    ransomwareAssociated: false,
    malwareAssociated: true,
    threatActorAssociated: 'Suspected nation-state',
    exploitMaturity: 'POC',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://www.cisa.gov/news-events/alerts/2024/03/29/reported-supply-chain-compromise-affecting-xz-utils-data-compression-library',
    recommendedAction: 'Inventory SSH-enabled Linux systems. Roll back xz 5.6.0/5.6.1. Rebuild affected images from trusted baselines.',
  },
  {
    cve: 'CVE-2023-34362',
    threatName: 'MOVEit Transfer SQL Injection (Cl0p ransomware)',
    threatSource: 'CISA KEV / Progress Software',
    activeExploitation: true,
    publicExploitAvailable: true,
    ransomwareAssociated: true,
    malwareAssociated: true,
    threatActorAssociated: 'Cl0p (TA505)',
    exploitMaturity: 'WEAPONIZED',
    intelligenceConfidence: 'HIGH',
    sourceReference: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a',
    recommendedAction: 'Apply MOVEit patch. Isolate transfer servers. Review file exfiltration indicators for May-June 2023 activity.',
  },
  {
    cve: 'CVE-2022-22965',
    threatName: 'Spring4Shell Remote Code Execution',
    threatSource: 'VMware Tanzu / CERT/CC',
    activeExploitation: true,
    publicExploitAvailable: true,
    ransomwareAssociated: false,
    malwareAssociated: true,
    threatActorAssociated: null,
    exploitMaturity: 'FUNCTIONAL',
    intelligenceConfidence: 'MEDIUM',
    sourceReference: 'https://spring.io/blog/2022/03/31/spring-framework-rce-early-announcement',
    recommendedAction: 'Upgrade Spring Framework to 5.3.18+ / Boot 2.6.6+. Restrict Tomcat access. Deploy WAF virtual patch rules.',
  },
  {
    cve: 'CVE-2024-21413',
    threatName: 'Microsoft Outlook MonikerLink RCE',
    threatSource: 'Microsoft MSRC',
    activeExploitation: false,
    publicExploitAvailable: true,
    ransomwareAssociated: false,
    malwareAssociated: false,
    threatActorAssociated: null,
    exploitMaturity: 'POC',
    intelligenceConfidence: 'MEDIUM',
    sourceReference: 'https://msrc.microsoft.com/update-guide/vulnerability/CVE-2024-21413',
    recommendedAction: 'Apply February 2024 Office security updates. Block external RTF/MonikerLink in email gateway.',
  },
];
