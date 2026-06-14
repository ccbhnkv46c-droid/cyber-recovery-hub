import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { buildGroundedContext, askLLM } from '../services/copilot/engine';

const router = Router();

async function analyticsAnswer(question: string, context: Awaited<ReturnType<typeof buildGroundedContext>>) {
  const q = question.toLowerCase();
  let answer = '';
  let data: unknown = null;

  if (q.includes('chase') || q.includes('today') || q.includes('priority')) {
    const toChase = context.topFindings.filter((f) => f.daysRemaining <= 3);
    answer = `Prioritise ${toChase.length} findings today based on SLA proximity and escalation status.`;
    data = toChase;
  } else if (q.includes('application') || q.includes('highest risk')) {
    answer = `${context.appRisks[0]?.name || 'N/A'} presents the highest aggregate application risk.`;
    data = context.appRisks;
  } else if (q.includes('team') && (q.includes('sla') || q.includes('miss'))) {
    answer = `${context.teamStats[0]?.name || 'N/A'} has the most overdue items.`;
    data = context.teamStats;
  } else if (q.includes('executive') || q.includes('summary') || q.includes('ciso') || q.includes('board')) {
    answer = `Executive Summary\n\n${context.summary}\n\nKey actions: Address ${context.metrics.overdue} overdue findings. Review ${context.metrics.blocked} blocked items.`;
    data = context.metrics;
  } else if (q.includes('remediation') || q.includes('priorit')) {
    answer = 'Recommended remediation priorities by recovery score:';
    data = context.topFindings.map((f, i) => ({ rank: i + 1, ...f }));
  } else if (q.includes('predict') || q.includes('overdue')) {
    const atRisk = context.topFindings.filter((f) => f.daysRemaining >= 0 && f.daysRemaining <= 7);
    answer = `${atRisk.length} findings likely to become overdue within 7 days.`;
    data = atRisk;
  } else {
    answer = context.summary;
    data = context.metrics;
  }

  return { answer, data, source: 'analytics' as const };
}

router.post('/ask', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question required' });
  }

  const context = await buildGroundedContext();
  const llm = await askLLM(question, context);

  if (llm.answer) {
    return res.json({
      question,
      answer: llm.answer,
      data: { metrics: context.metrics, topFindings: context.topFindings.slice(0, 5) },
      source: llm.source,
      generatedAt: new Date().toISOString(),
      assistant: 'Recovery Copilot',
    });
  }

  const result = await analyticsAnswer(question, context);
  res.json({
    question,
    ...result,
    generatedAt: new Date().toISOString(),
    assistant: 'Recovery Copilot',
  });
});

router.get('/status', authMiddleware, async (_req, res) => {
  const { config } = await import('../../lib/config');
  res.json({
    mode: config.copilot.openaiApiKey ? 'llm+grounded' : 'analytics',
    model: config.copilot.openaiModel,
    grounded: true,
  });
});

export default router;
