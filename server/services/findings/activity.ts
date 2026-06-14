import prisma from '../../../lib/prisma';
import { config } from '../../../lib/config';
import { dispatchNotification } from '../notifications/dispatcher';
import { getDaysRemaining } from '../../../lib/constants';
import { STATUS_LABELS } from '../../../lib/services';
import { isAssignedOnlyRole } from '../../../lib/rbac';

interface FindingUpdateEmailParams {
  findingId: string;
  title: string;
  serviceName: string;
  severity: string;
  status: string;
  latestComment?: string;
  nextSteps?: string;
  targetDate: Date;
  updatedByName: string;
  ownerEmail?: string;
  ownerName?: string;
  managerEmail?: string;
  teamLeaderEmail?: string;
  /** When true: TO Cyber Recovery Team, CC SME/Leader/Manager */
  smeInitiated?: boolean;
}

const CYBER_RECOVERY_TEAM = config.notifications.cyberRecoveryTeamEmail;

export async function sendFindingUpdateEmail(params: FindingUpdateEmailParams & { userId?: string; findingDbId?: string }) {
  const daysRemaining = getDaysRemaining(params.targetDate);
  const statusLabel = STATUS_LABELS[params.status] || params.status;

  const body = `
Cyber Recovery Hub — Vulnerability Update

Finding ID:    ${params.findingId}
Title:         ${params.title}
Service:       ${params.serviceName}
Severity:      ${params.severity}
Status:        ${statusLabel}
Due Date:      ${params.targetDate.toLocaleDateString('en-GB')}
Days Remaining: ${daysRemaining < 0 ? `${Math.abs(daysRemaining)} days OVERDUE` : `${daysRemaining} days`}

Latest Comment:
${params.latestComment || '—'}

Next Steps:
${params.nextSteps || '—'}

Updated By:    ${params.updatedByName}
Updated At:    ${new Date().toLocaleString('en-GB')}

—
Cyber Recovery Hub | Automated Notification
`.trim();

  const emailPayload = {
    subject: `[CRH] ${params.findingId} — ${statusLabel} — ${params.title.slice(0, 60)}`,
    message: body,
    findingId: params.findingId,
    channel: 'EMAIL' as const,
  };

  if (params.smeInitiated) {
    // SME update: TO Cyber Recovery Team, CC assigned SME + leaders
    await dispatchNotification({ ...emailPayload, to: CYBER_RECOVERY_TEAM }, { userId: params.userId, findingId: params.findingDbId });

    const ccRecipients: string[] = [];
    if (params.ownerEmail) ccRecipients.push(params.ownerEmail);
    if (params.teamLeaderEmail) ccRecipients.push(params.teamLeaderEmail);
    if (params.managerEmail) ccRecipients.push(params.managerEmail);

    const seen = new Set<string>([CYBER_RECOVERY_TEAM]);
    for (const email of ccRecipients) {
      if (seen.has(email)) continue;
      seen.add(email);
      await dispatchNotification({
        ...emailPayload,
        subject: `[CRH CC] ${params.findingId} — ${statusLabel}`,
        to: email,
      }, { userId: params.userId, findingId: params.findingDbId });
    }
    return;
  }

  // Admin/system update: notify all stakeholders
  const recipients: { email: string }[] = [];
  if (params.ownerEmail) recipients.push({ email: params.ownerEmail });
  if (params.teamLeaderEmail) recipients.push({ email: params.teamLeaderEmail });
  if (params.managerEmail) recipients.push({ email: params.managerEmail });
  recipients.push({ email: CYBER_RECOVERY_TEAM });

  const seen = new Set<string>();
  for (const r of recipients) {
    if (seen.has(r.email)) continue;
    seen.add(r.email);
    await dispatchNotification({ ...emailPayload, to: r.email }, { userId: params.userId, findingId: params.findingDbId });
  }
}

export async function notifyFindingUpdate(findingDbId: string, userId: string, latestComment?: string) {
  const finding = await prisma.finding.findUnique({
    where: { id: findingDbId },
    include: {
      service: true,
      owner: { select: { email: true, name: true } },
      manager: { select: { email: true, name: true } },
      team: { select: { leaderId: true } },
    },
  });
  if (!finding) return;

  const updater = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true } });

  let teamLeaderEmail: string | undefined;
  if (finding.team?.leaderId) {
    const leader = await prisma.user.findUnique({ where: { id: finding.team.leaderId }, select: { email: true } });
    teamLeaderEmail = leader?.email;
  }

  await sendFindingUpdateEmail({
    findingId: finding.findingId,
    findingDbId: findingDbId,
    userId,
    title: finding.title,
    serviceName: finding.service.name,
    severity: finding.severity,
    status: finding.status,
    latestComment,
    nextSteps: finding.nextSteps || finding.nextAction || undefined,
    targetDate: finding.targetDate,
    updatedByName: updater?.name || 'System',
    ownerEmail: finding.owner?.email,
    ownerName: finding.owner?.name,
    managerEmail: finding.manager?.email,
    teamLeaderEmail,
    smeInitiated: isAssignedOnlyRole(updater?.role || ''),
  });
}

export async function recordActivity(params: {
  findingId: string;
  userId?: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.activity.create({
    data: {
      findingId: params.findingId,
      userId: params.userId,
      type: params.type,
      content: params.content,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
    include: { user: { select: { id: true, name: true, role: true } } },
  });
}
