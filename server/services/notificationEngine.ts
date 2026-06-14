import prisma from '../../lib/prisma';
import { ACTIVE_STATUSES, getDaysRemaining } from '../../lib/constants';
import { dispatchNotification } from './notifications/dispatcher';

export async function processSlaReminders() {
  const findings = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES }, ownerId: { not: null } },
    include: { owner: true },
  });

  for (const finding of findings) {
    const daysRemaining = getDaysRemaining(finding.targetDate);
    if (daysRemaining > 7 || daysRemaining < 0) continue;

    const lastReminder = finding.lastReminderAt;
    if (lastReminder && Date.now() - lastReminder.getTime() < 48 * 60 * 60 * 1000) continue;

    const message = `SLA Reminder: Finding ${finding.findingId} "${finding.title}" has ${daysRemaining} day(s) remaining. Please update remediation progress.`;

    await prisma.finding.update({
      where: { id: finding.id },
      data: { lastReminderAt: new Date() },
    });

    if (finding.ownerId) {
      await prisma.notification.create({
        data: {
          userId: finding.ownerId,
          findingId: finding.id,
          title: `SLA Reminder: ${finding.findingId}`,
          message,
          channel: 'EMAIL',
        },
      });

      if (finding.owner?.email) {
        await dispatchNotification({
          to: finding.owner.email,
          subject: `SLA Reminder: ${finding.findingId}`,
          message,
          findingId: finding.findingId,
          channel: 'EMAIL',
        });
      }
    }
  }
}
