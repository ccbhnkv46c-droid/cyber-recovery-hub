import { processEscalations } from '../escalationEngine';
import { processSlaReminders } from '../notificationEngine';
import { cleanupExpiredSessions } from '../../middleware/auth';
import { config } from '../../../lib/config';

type JobName = 'escalations' | 'sla-reminders' | 'session-cleanup';

const handlers: Record<JobName, () => Promise<void>> = {
  escalations: processEscalations,
  'sla-reminders': processSlaReminders,
  'session-cleanup': cleanupExpiredSessions,
};

let queue: { add: (name: JobName) => Promise<void>; close: () => Promise<void> } | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;

export async function initJobQueue() {
  if (!config.enableBackgroundJobs) {
    console.log('[Jobs] Background jobs disabled');
    return;
  }

  if (config.redisUrl) {
    try {
      const { Queue, Worker } = await import('bullmq');

      const connection = {
        url: config.redisUrl,
        maxRetriesPerRequest: null,
      };

      const bullQueue = new Queue('crh-jobs', { connection });

      new Worker('crh-jobs', async (job) => {
        const handler = handlers[job.name as JobName];
        if (handler) await handler();
      }, { connection });

      await bullQueue.add('escalations', {}, { repeat: { every: 5 * 60 * 1000 } });
      await bullQueue.add('sla-reminders', {}, { repeat: { every: 5 * 60 * 1000 } });
      await bullQueue.add('session-cleanup', {}, { repeat: { every: 60 * 60 * 1000 } });

      queue = {
        add: async (name) => { await bullQueue.add(name, {}); },
        close: async () => { await bullQueue.close(); },
      };

      console.log('[Jobs] BullMQ queue connected via Redis');
      return;
    } catch (err) {
      console.warn('[Jobs] Redis unavailable, falling back to in-process scheduler:', (err as Error).message);
    }
  }

  const runAll = async () => {
    for (const [name, handler] of Object.entries(handlers)) {
      try {
        await handler();
      } catch (err) {
        console.error(`[Jobs] ${name} failed:`, err);
      }
    }
  };

  intervalId = setInterval(runAll, 5 * 60 * 1000);
  console.log('[Jobs] In-process scheduler active (5min interval)');
}

export async function shutdownJobQueue() {
  if (queue) await queue.close();
  if (intervalId) clearInterval(intervalId);
}

export async function triggerJob(name: JobName) {
  const handler = handlers[name];
  if (handler) await handler();
}
