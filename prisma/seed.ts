import { PrismaClient } from '@prisma/client';
import { Severity, EscalationLevel, FindingStatus, UserRole } from '../lib/constants';
import bcrypt from 'bcryptjs';
import { DEFAULT_SERVICES } from '../lib/services';
import { calculateRiskScore, calculateTargetDate, SLA_DAYS } from '../lib/constants';

const prisma = new PrismaClient();

const BUSINESS_AREAS = [
  'Investment Banking', 'Retail Banking', 'Wealth Management', 'Risk & Compliance',
  'Trading Systems', 'Payments', 'Corporate Banking', 'Treasury', 'Cyber Security', 'Infrastructure',
];

const TECHNOLOGIES = [
  'Java/Spring Boot', 'Node.js', 'Python/Django', '.NET Core', 'React', 'Angular',
  'PostgreSQL', 'Oracle DB', 'MongoDB', 'Redis', 'Kubernetes', 'Docker',
  'AWS EC2', 'Azure VMs', 'Windows Server 2019', 'Linux RHEL 8', 'VMware vSphere',
  'Active Directory', 'Entra ID', 'Okta', 'Firewall (Palo Alto)', 'Load Balancer (F5)',
  'Apache Tomcat', 'NGINX', 'IIS', 'Jenkins', 'GitLab CI', 'Terraform',
];

const VULN_TITLES = [
  'Remote Code Execution in {app}',
  'SQL Injection vulnerability in {app}',
  'Cross-Site Scripting (XSS) in {app}',
  'Outdated SSL/TLS configuration on {app}',
  'Missing security patches on {app}',
  'Weak authentication mechanism in {app}',
  'Insecure direct object reference in {app}',
  'Privilege escalation vulnerability in {app}',
  'Unencrypted sensitive data at rest in {app}',
  'Default credentials detected on {app}',
  'Open redirect vulnerability in {app}',
  'Server-side request forgery in {app}',
  'XML external entity injection in {app}',
  'Insecure deserialization in {app}',
  'Buffer overflow in {app}',
  'Missing HTTP security headers on {app}',
  'Exposed admin interface on {app}',
  'Weak cipher suites on {app}',
  'Directory traversal in {app}',
  'Log injection vulnerability in {app}',
  'CSRF token missing in {app}',
  'Hardcoded API keys in {app}',
  'Unrestricted file upload in {app}',
  'LDAP injection in {app}',
  'Command injection in {app}',
];

const APPLICATIONS = [
  { name: 'TradeFlow Platform', service: 'Equities Trading', area: 'Trading Systems', stack: 'Java/Spring Boot', cloud: 'AWS' },
  { name: 'Payment Gateway', service: 'Payment Processing', area: 'Payments', stack: 'Node.js', cloud: 'Azure' },
  { name: 'Customer Portal', service: 'Retail Banking', area: 'Retail Banking', stack: 'React/Node.js', cloud: 'AWS' },
  { name: 'Risk Analytics Engine', service: 'Risk Management', area: 'Risk & Compliance', stack: 'Python/Django', cloud: 'GCP' },
  { name: 'Wealth Advisor Suite', service: 'Portfolio Management', area: 'Wealth Management', stack: '.NET Core', cloud: 'Azure' },
  { name: 'Core Banking System', service: 'Account Management', area: 'Corporate Banking', stack: 'Java/Oracle', cloud: 'On-Premise' },
  { name: 'Treasury Management', service: 'Liquidity Management', area: 'Treasury', stack: 'Java/Spring Boot', cloud: 'AWS' },
  { name: 'Fraud Detection ML', service: 'Anti-Fraud', area: 'Cyber Security', stack: 'Python/TensorFlow', cloud: 'AWS' },
  { name: 'Identity Gateway', service: 'Authentication', area: 'Infrastructure', stack: 'Node.js/Okta', cloud: 'Azure' },
  { name: 'Market Data Feed', service: 'Real-time Pricing', area: 'Trading Systems', stack: 'C++/Kafka', cloud: 'On-Premise' },
  { name: 'Regulatory Reporting', service: 'Compliance Reporting', area: 'Risk & Compliance', stack: 'Python/SQL', cloud: 'Azure' },
  { name: 'Mobile Banking App', service: 'Mobile Banking', area: 'Retail Banking', stack: 'React Native', cloud: 'AWS' },
  { name: 'SWIFT Messaging', service: 'International Payments', area: 'Payments', stack: 'Java/MQ', cloud: 'On-Premise' },
  { name: 'Data Lake Platform', service: 'Analytics', area: 'Infrastructure', stack: 'Spark/Hadoop', cloud: 'AWS' },
  { name: 'HR Management System', service: 'Human Resources', area: 'Corporate Banking', stack: 'SAP', cloud: 'On-Premise' },
];

const FIRST_NAMES = ['James', 'Sarah', 'Michael', 'Emma', 'David', 'Olivia', 'Robert', 'Sophie', 'William', 'Charlotte', 'Thomas', 'Amelia', 'Daniel', 'Isabella', 'Matthew'];
const LAST_NAMES = ['Wilson', 'Chen', 'Thompson', 'Okonkwo', 'Richardson', 'Patel', 'O\'Brien', 'Kowalski', 'Nakamura', 'Andersson', 'Müller', 'Dubois', 'Rossi', 'Kim', 'Santos'];

function random<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return d;
}

async function main() {
  console.log('Seeding Cyber Recovery Hub database...');

  await prisma.notification.deleteMany();
  await prisma.escalationEvent.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.finding.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.application.deleteMany();
  await prisma.service.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.integrationConfig.deleteMany();

  const services = await Promise.all(
    DEFAULT_SERVICES.map((s) => prisma.service.create({ data: s }))
  );
  const serviceByName = Object.fromEntries(services.map((s) => [s.name, s.id]));

  function pickService(technology: string): string {
    const tech = technology.toLowerCase();
    if (tech.includes('active directory') || tech.includes('ad ')) return serviceByName['Active Directory'];
    if (tech.includes('entra')) return serviceByName['Entra ID'];
    if (tech.includes('sailpoint')) return serviceByName['SailPoint ISC'];
    if (tech.includes('cyberark') || tech.includes('okta')) return serviceByName['CyberArk'];
    if (tech.includes('aws')) return serviceByName['AWS'];
    if (tech.includes('azure')) return serviceByName['Azure'];
    if (tech.includes('linux') || tech.includes('rhel')) return serviceByName['Linux'];
    if (tech.includes('windows')) return serviceByName['Windows'];
    if (tech.includes('firewall') || tech.includes('load balancer') || tech.includes('vpn')) return serviceByName['Networks'];
    if (tech.includes('exchange')) return serviceByName['Exchange'];
    if (tech.includes('office') || tech.includes('365')) return serviceByName['Microsoft 365'];
    return services[Math.floor(Math.random() * services.length)].id;
  }

  const passwordHash = await bcrypt.hash('demo123', 10);

  const teams = await Promise.all(
    BUSINESS_AREAS.map((area) =>
      prisma.team.create({ data: { name: `${area} Team`, businessArea: area } })
    )
  );

  const managers: { id: string; teamId: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const team = teams[i % teams.length];
    const mgr = await prisma.user.create({
      data: {
        email: `manager${i + 1}@bank.com`,
        name: `${random(FIRST_NAMES)} ${random(LAST_NAMES)}`,
        passwordHash,
        role: 'ENGINEERING_MANAGER' as UserRole,
        department: team.businessArea,
        teamId: team.id,
      },
    });
    managers.push({ id: mgr.id, teamId: team.id });
  }

  const leaders: { id: string; teamId: string }[] = [];
  for (const team of teams) {
    const leader = await prisma.user.create({
      data: {
        email: `leader.${team.name.toLowerCase().replace(/\s/g, '.')}@bank.com`,
        name: `${random(FIRST_NAMES)} ${random(LAST_NAMES)}`,
        passwordHash,
        role: 'TEAM_LEADER' as UserRole,
        department: team.businessArea,
        teamId: team.id,
      },
    });
    leaders.push({ id: leader.id, teamId: team.id });
    await prisma.team.update({ where: { id: team.id }, data: { leaderId: leader.id } });
  }

  const engineers: { id: string; teamId: string; managerId: string }[] = [];
  for (let i = 0; i < 40; i++) {
    const team = teams[i % teams.length];
    const mgr = managers.find((m) => m.teamId === team.id) || managers[0];
    const eng = await prisma.user.create({
      data: {
        email: `engineer${i + 1}@bank.com`,
        name: `${random(FIRST_NAMES)} ${random(LAST_NAMES)}`,
        passwordHash,
        role: 'ENGINEER' as UserRole,
        department: team.businessArea,
        teamId: team.id,
        managerId: mgr.id,
      },
    });
    engineers.push({ id: eng.id, teamId: team.id, managerId: mgr.id });
  }

  const demoUsers = [
    { email: 'analyst@bank.com', name: 'Sarah Chen', role: 'SECURITY_ANALYST' as UserRole, teamId: teams[9].id },
    { email: 'engineer@bank.com', name: 'James Wilson', role: 'ENGINEER' as UserRole, teamId: engineers[0].teamId, managerId: engineers[0].managerId },
    { email: 'leader@bank.com', name: 'Emma Thompson', role: 'TEAM_LEADER' as UserRole, teamId: leaders[0].teamId },
    { email: 'manager@bank.com', name: 'David Okonkwo', role: 'ENGINEERING_MANAGER' as UserRole, teamId: managers[0].teamId },
    { email: 'ciso@bank.com', name: 'Michael Richardson', role: 'CISO' as UserRole },
    { email: 'board@bank.com', name: 'Board Viewer', role: 'BOARD' as UserRole },
    { email: 'admin@bank.com', name: 'System Admin', role: 'ADMIN' as UserRole },
  ];

  for (const du of demoUsers) {
    const existing = await prisma.user.findUnique({ where: { email: du.email } });
    if (!existing) {
      await prisma.user.create({ data: { ...du, passwordHash, department: 'Cyber Security' } });
    }
  }

  const analyst = await prisma.user.findUnique({ where: { email: 'analyst@bank.com' } });
  const administrator = await prisma.user.findUnique({ where: { email: 'administrator@crh.bank.com' } });

  // SME accounts — unique dev passwords (see SETUP.md; never use in production)
  const SME_ACCOUNTS = [
    { email: 'richard.knight@crh.bank.com', name: 'Richard Knight', password: 'RkCrh2025!' },
    { email: 'sammi.powell@crh.bank.com', name: 'Sammi Powell', password: 'SpCrh2025!' },
    { email: 'michael.oconnor@crh.bank.com', name: "Michael O'Connor", password: 'MoCrh2025!' },
    { email: 'steven.k@crh.bank.com', name: 'Steven K', password: 'SkCrh2025!' },
  ];

  const smeUsers: { id: string; name: string; email: string }[] = [];
  for (const sme of SME_ACCOUNTS) {
    const existing = await prisma.user.findUnique({ where: { email: sme.email } });
    if (!existing) {
      const hash = await bcrypt.hash(sme.password, 10);
      const user = await prisma.user.create({
        data: {
          email: sme.email,
          name: sme.name,
          passwordHash: hash,
          role: 'SME' as UserRole,
          department: 'Cyber Security',
          teamId: teams[9].id,
        },
      });
      smeUsers.push({ id: user.id, name: user.name, email: user.email });
    }
  }

  if (!administrator) {
    const adminHash = await bcrypt.hash('AdminCrh2025!', 10);
    await prisma.user.create({
      data: {
        email: 'administrator@crh.bank.com',
        name: 'Administrator',
        passwordHash: adminHash,
        role: 'ADMIN' as UserRole,
        department: 'Cyber Security',
      },
    });
  }

  const adminUser = await prisma.user.findUnique({ where: { email: 'administrator@crh.bank.com' } });
  // Reload SME users if already existed
  if (smeUsers.length === 0) {
    for (const sme of SME_ACCOUNTS) {
      const u = await prisma.user.findUnique({ where: { email: sme.email } });
      if (u) smeUsers.push({ id: u.id, name: u.name, email: u.email });
    }
  }

  const demoEngineer = await prisma.user.findUnique({ where: { email: 'engineer@bank.com' } });

  const apps = await Promise.all(
    APPLICATIONS.map((app, i) =>
      prisma.application.create({
        data: {
          name: app.name,
          businessService: app.service,
          businessArea: app.area,
          technologyStack: app.stack,
          cloudPlatform: app.cloud,
          cmdbId: `CMDB-${10000 + i}`,
          environment: random(['PRODUCTION', 'PRODUCTION', 'PRODUCTION', 'STAGING', 'DEVELOPMENT']),
          ownerId: engineers[i % engineers.length].id,
          managerId: managers[i % managers.length].id,
        },
      })
    )
  );

  const severities: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const severityWeights = [0.08, 0.22, 0.40, 0.30];
  const statuses: FindingStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'PENDING_REVIEW', 'PENDING_EXCEPTION', 'RISK_ACCEPTED', 'REMEDIATED', 'CLOSED'];
  const statusWeights = [0.25, 0.30, 0.08, 0.07, 0.05, 0.05, 0.12, 0.08];
  const escalationLevels: EscalationLevel[] = ['NONE', 'ENGINEER_REMINDER', 'ENGINEER_REMINDER_2', 'TEAM_LEADER', 'ENGINEERING_MANAGER', 'HEAD_OF_TECHNOLOGY', 'CISO'];

  function weightedRandom<T>(items: T[], weights: number[]): T {
    const r = Math.random();
    let cumulative = 0;
    for (let i = 0; i < items.length; i++) {
      cumulative += weights[i];
      if (r <= cumulative) return items[i];
    }
    return items[items.length - 1];
  }

  const findings = [];
  for (let i = 1; i <= 520; i++) {
    const severity = weightedRandom(severities, severityWeights);
    const status = weightedRandom(statuses, statusWeights);
    const app = random(apps);
    const eng = random(engineers);
    const team = teams.find((t) => t.id === eng.teamId)!;
    const mgr = managers.find((m) => m.teamId === team.id) || managers[0];
    const createdAt = randomDate(180);
    const cvssScore = severity === 'CRITICAL' ? randomFloat(9.0, 10.0) :
      severity === 'HIGH' ? randomFloat(7.0, 8.9) :
      severity === 'MEDIUM' ? randomFloat(4.0, 6.9) : randomFloat(0.1, 3.9);

    const risk = calculateRiskScore({
      cvssScore,
      exploitability: randomFloat(3, 10),
      likelihood: randomFloat(3, 10),
      exposure: randomFloat(3, 10),
      criticality: randomFloat(3, 10),
    });

    const titleTemplate = random(VULN_TITLES);
    const title = titleTemplate.replace('{app}', app.name);

    const targetDate = calculateTargetDate(severity, createdAt);
    const isClosed = ['REMEDIATED', 'CLOSED'].includes(status);
    const closedAt = isClosed ? new Date(createdAt.getTime() + Math.random() * (Date.now() - createdAt.getTime())) : null;

    const technology = random(TECHNOLOGIES);
    const serviceId = pickService(technology);
    const assignedAt = randomDate(90);

    // Assignment model: 200 unassigned (admin assigns), rest split across 4 SMEs
    let ownerId: string | null = null;
    let assignedById: string | undefined;
    let assignedAtVal: Date | undefined;
    if (i > 200 && smeUsers.length === 4) {
      const smeIndex = Math.floor((i - 201) / 80);
      const sme = smeUsers[Math.min(smeIndex, 3)];
      ownerId = sme.id;
      assignedById = adminUser?.id;
      assignedAtVal = assignedAt;
    }

    const finding = await prisma.finding.create({
      data: {
        findingId: `CRH-${String(i).padStart(5, '0')}`,
        title,
        description: `Security assessment identified ${title.toLowerCase()}. This vulnerability was detected during routine scanning and requires remediation per organisational security policy.`,
        businessImpact: `Potential impact to ${app.businessService} operations in ${app.businessArea}. Could affect customer data integrity and regulatory compliance.`,
        technicalImpact: `Technical exploitation could lead to unauthorised access, data exfiltration, or service disruption on ${app.name} infrastructure.`,
        severity,
        cvssScore,
        exploitability: randomFloat(3, 10),
        likelihood: randomFloat(3, 10),
        exposure: randomFloat(3, 10),
        criticality: randomFloat(3, 10),
        ...risk,
        mitigation: `Apply vendor patches, implement WAF rules, and conduct validation testing post-remediation.`,
        remediationPlan: `1. Assess impact scope\n2. Develop patch/fix plan\n3. Test in non-production\n4. Deploy to production\n5. Validate and close`,
        status,
        priority: severity,
        progress: status === 'IN_PROGRESS' ? Math.floor(Math.random() * 80) + 10 : status === 'REMEDIATED' || status === 'CLOSED' ? 100 : 0,
        escalationLevel: status === 'OPEN' || status === 'IN_PROGRESS'
          ? weightedRandom(escalationLevels, [0.5, 0.2, 0.1, 0.08, 0.06, 0.04, 0.02])
          : 'NONE',
        serviceId,
        applicationId: app.id,
        businessService: app.businessService,
        technology,
        asset: `${app.name}-${random(['prod', 'uat', 'dev'])}-${random(['web', 'app', 'db', 'api'])}-${randomFloat(1, 99, 0)}`,
        businessArea: app.businessArea,
        ownerId,
        assignedById,
        assignedAt: assignedAtVal,
        dateIdentified: createdAt,
        teamId: ownerId ? team.id : null,
        managerId: ownerId ? mgr.id : null,
        businessOwnerId: managers[Math.floor(Math.random() * managers.length)].id,
        slaDays: SLA_DAYS[severity],
        targetDate,
        plannedCompletionDate: isClosed ? closedAt : new Date(targetDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        actualCompletionDate: isClosed ? closedAt : null,
        createdAt,
        closedAt,
        nextAction: status === 'BLOCKED' ? 'Awaiting vendor patch' :
          status === 'IN_PROGRESS' ? 'Remediation in progress' : 'Initial triage required',
        nextSteps: status === 'IN_PROGRESS' ? 'Complete patch deployment and validate in production' : 'Assign SME and begin triage',
        riskAccepted: status === 'RISK_ACCEPTED',
        riskAcceptedAt: status === 'RISK_ACCEPTED' ? randomDate(30) : null,
        exceptionExpiry: status === 'RISK_ACCEPTED' ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : null,
        blockerReason: status === 'BLOCKED' ? random(['Vendor patch unavailable', 'Change freeze period', 'Dependency on third party', 'Resource constraints']) : null,
        blockerSince: status === 'BLOCKED' ? randomDate(14) : null,
      },
    });
    findings.push(finding);
  }

  if (analyst) {
    for (let i = 0; i < 20; i++) {
      await prisma.auditLog.create({
        data: {
          userId: analyst.id,
          findingId: findings[i].id,
          action: random(['VIEW', 'UPDATE', 'COMMENT', 'ESCALATE']),
          entityType: 'Finding',
          entityId: findings[i].id,
          ipAddress: '10.0.0.' + Math.floor(Math.random() * 255),
          createdAt: randomDate(30),
        },
      });
    }
  }

  for (let i = 0; i < 30; i++) {
    const finding = findings[Math.floor(Math.random() * findings.length)];
    const eng = engineers[Math.floor(Math.random() * engineers.length)];
    const commentTypes = ['COMMENT', 'COMMENT', 'NEXT_STEP', 'BLOCKER', 'PROGRESS_UPDATE'];
    const type = random(commentTypes);
    const content = random([
      'Patch scheduled for next maintenance window.',
      'Waiting for vendor response on fix timeline.',
      'Remediation completed in UAT, pending production deployment.',
      'Risk assessment completed, proceeding with fix.',
      'Blocked due to change freeze until end of quarter.',
    ]);
    await prisma.comment.create({
      data: {
        findingId: finding.id,
        userId: eng.id,
        content,
        type,
        createdAt: randomDate(14),
      },
    });
    await prisma.activity.create({
      data: {
        findingId: finding.id,
        userId: eng.id,
        type: type === 'NEXT_STEP' ? 'NEXT_STEP' : type === 'BLOCKER' ? 'BLOCKER' : 'COMMENT',
        content,
        createdAt: randomDate(14),
      },
    });
  }

  for (const f of findings.slice(0, 50)) {
    await prisma.activity.create({
      data: {
        findingId: f.id,
        userId: analyst?.id,
        type: 'CREATED',
        content: `Finding ${f.findingId} created`,
        createdAt: f.createdAt,
      },
    });
    if (f.ownerId) {
      await prisma.activity.create({
        data: {
          findingId: f.id,
          userId: analyst?.id,
          type: 'ASSIGNED',
          content: 'Assigned to SME for remediation',
          createdAt: f.assignedAt || f.createdAt,
        },
      });
    }
  }

  for (let i = 0; i < 15; i++) {
    const assigned = findings.filter((f) => f.ownerId);
    const finding = assigned[Math.floor(Math.random() * assigned.length)];
    if (!finding.ownerId) continue;
    await prisma.evidence.create({
      data: {
        findingId: finding.id,
        userId: finding.ownerId!,
        description: 'Remediation evidence uploaded',
        fileName: `evidence_${finding.findingId}.pdf`,
        verified: Math.random() > 0.5,
      },
    });
  }

  const integrationNames = ['ServiceNow', 'Qualys', 'Tenable', 'Microsoft Defender', 'Microsoft Teams', 'Jira', 'Power BI', 'Entra ID'];
  for (const name of integrationNames) {
    await prisma.integrationConfig.create({
      data: {
        name,
        type: name,
        isEnabled: false,
        config: JSON.stringify({ endpoint: `https://api.example.com/${name.toLowerCase()}`, apiKey: 'CONFIGURE_IN_PRODUCTION' }),
        description: `${name} integration adapter (not yet connected)`,
      },
    });
  }

  console.log(`Seeded: ${services.length} services, ${smeUsers.length} SMEs, ${teams.length} teams, ${engineers.length + managers.length + leaders.length + 7} users, ${apps.length} applications, ${findings.length} findings (${findings.filter((f) => !f.ownerId).length} unassigned)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
