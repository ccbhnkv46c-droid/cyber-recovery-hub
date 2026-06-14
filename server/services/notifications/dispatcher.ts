import { config } from '../../../lib/config';
import prisma from '../../../lib/prisma';

export interface NotificationPayload {
  to: string;
  subject: string;
  message: string;
  findingId?: string;
  channel: 'EMAIL' | 'TEAMS' | 'DASHBOARD';
}

export interface NotificationAdapter {
  name: string;
  send(payload: NotificationPayload): Promise<boolean>;
}

export class ConsoleEmailAdapter implements NotificationAdapter {
  name = 'console-email';

  async send(payload: NotificationPayload) {
    console.log(`[Email] To: ${payload.to} | Subject: ${payload.subject}`);
    console.log(`[Email] ${payload.message}`);
    return true;
  }
}

export class SmtpEmailAdapter implements NotificationAdapter {
  name = 'smtp';

  async send(payload: NotificationPayload) {
    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host: config.notifications.smtpHost,
        port: config.notifications.smtpPort,
        secure: config.notifications.smtpSecure || config.notifications.smtpPort === 465,
        auth: config.notifications.smtpUser
          ? { user: config.notifications.smtpUser, pass: config.notifications.smtpPass }
          : undefined,
      });
      await transport.sendMail({
        from: config.notifications.emailFrom,
        to: payload.to,
        subject: payload.subject,
        text: payload.message,
        html: `<p>${payload.message.replace(/\n/g, '<br>')}</p>`,
      });
      return true;
    } catch (err) {
      console.error('[SMTP] Send failed:', err);
      return false;
    }
  }
}

export class TeamsWebhookAdapter implements NotificationAdapter {
  name = 'teams-webhook';

  async send(payload: NotificationPayload) {
    if (!config.notifications.teamsWebhookUrl) return false;
    try {
      const card = {
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        themeColor: '1a82f5',
        summary: payload.subject,
        sections: [{
          activityTitle: payload.subject,
          facts: [
            { name: 'Finding', value: payload.findingId || 'N/A' },
            { name: 'Channel', value: 'Cyber Recovery Hub' },
          ],
          text: payload.message,
        }],
      };
      const res = await fetch(config.notifications.teamsWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      });
      return res.ok;
    } catch (err) {
      console.error('[Teams] Webhook failed:', err);
      return false;
    }
  }
}

const adapters: NotificationAdapter[] = [];

export function getNotificationAdapters(): NotificationAdapter[] {
  if (adapters.length === 0) {
    if (config.notifications.emailEnabled && config.notifications.smtpHost) {
      adapters.push(new SmtpEmailAdapter());
    } else {
      adapters.push(new ConsoleEmailAdapter());
    }
    if (config.notifications.teamsWebhookUrl) {
      adapters.push(new TeamsWebhookAdapter());
    }
  }
  return adapters;
}

export async function dispatchNotification(payload: NotificationPayload, meta?: { userId?: string; findingId?: string }) {
  const results: Record<string, boolean> = {};

  if (payload.channel === 'EMAIL' || payload.channel === 'DASHBOARD') {
    const emailAdapter = getNotificationAdapters().find((a) => a.name.includes('email') || a.name === 'smtp');
    if (emailAdapter) {
      results[emailAdapter.name] = await emailAdapter.send(payload);
      if (payload.channel === 'EMAIL' || payload.to) {
        await prisma.auditLog.create({
          data: {
            userId: meta?.userId,
            findingId: meta?.findingId,
            action: 'EMAIL_SENT',
            entityType: 'Email',
            newValue: JSON.stringify({
              to: payload.to,
              subject: payload.subject,
              findingId: payload.findingId,
            }),
          },
        });
      }
    }
  }

  if (payload.channel === 'TEAMS' || payload.channel === 'DASHBOARD') {
    const teamsAdapter = getNotificationAdapters().find((a) => a.name === 'teams-webhook');
    if (teamsAdapter) results[teamsAdapter.name] = await teamsAdapter.send(payload);
  }

  return results;
}
