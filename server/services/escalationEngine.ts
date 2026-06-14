import prisma from '../../lib/prisma';
import {
  getNextEscalationLevel,
  generateEscalationMessage,
  ACTIVE_STATUSES,
  getDaysRemaining,
  EscalationLevel,
} from '../../lib/constants';
import { dispatchNotification } from './notifications/dispatcher';

export async function processEscalations() {
  const findings = await prisma.finding.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      targetDate: { lt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    },
    include: { owner: true, manager: true },
  });

  for (const finding of findings) {
    const daysRemaining = getDaysRemaining(finding.targetDate);
    let shouldEscalate = false;

    if (daysRemaining < 0 && finding.escalationLevel === 'NONE') shouldEscalate = true;
    else if (daysRemaining <= 1 && finding.escalationLevel === 'ENGINEER_REMINDER') shouldEscalate = true;
    else if (daysRemaining <= 3 && finding.escalationLevel === 'NONE') shouldEscalate = true;

    if (!shouldEscalate) continue;

    const lastEsc = finding.lastEscalationAt;
    if (lastEsc && Date.now() - lastEsc.getTime() < 24 * 60 * 60 * 1000) continue;

    const newLevel = getNextEscalationLevel(finding.escalationLevel as EscalationLevel);
    const message = generateEscalationMessage(
      newLevel,
      finding.findingId,
      finding.title,
      finding.owner?.name || 'Unassigned'
    );

    await prisma.finding.update({
      where: { id: finding.id },
      data: { escalationLevel: newLevel, lastEscalationAt: new Date() },
    });

    await prisma.escalationEvent.create({
      data: {
        findingId: finding.id,
        level: newLevel,
        message,
        sentTo: finding.owner?.email || 'auto',
        channel: 'DASHBOARD',
      },
    });

    if (finding.ownerId) {
      await prisma.notification.create({
        data: {
          userId: finding.ownerId,
          findingId: finding.id,
          title: `Auto-escalation: ${finding.findingId}`,
          message,
          channel: 'DASHBOARD',
        },
      });

      if (finding.owner?.email) {
        await dispatchNotification({
          to: finding.owner.email,
          subject: `Escalation: ${finding.findingId}`,
          message,
          findingId: finding.findingId,
          channel: 'EMAIL',
        });
      }

      if (['TEAM_LEADER', 'ENGINEERING_MANAGER', 'CISO', 'BOARD'].includes(newLevel) && finding.manager?.email) {
        await dispatchNotification({
          to: finding.manager.email,
          subject: `Escalation [${newLevel}]: ${finding.findingId}`,
          message,
          findingId: finding.findingId,
          channel: 'TEAMS',
        });
      }
    }
  }
}
