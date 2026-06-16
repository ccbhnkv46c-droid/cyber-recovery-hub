import prisma from '../../../lib/prisma';
import { ACTIVE_STATUSES, getDaysRemaining } from '../../../lib/constants';

export interface GroundedContext {
  summary: string;
  metrics: Record<string, number | string>;
  topFindings: { findingId: string; title: string; severity: string; recoveryScore: number; daysRemaining: number }[];
  teamStats: { name: string; overdue: number; total: number }[];
  appRisks: { name: string; count: number; avgRisk: number }[];
}

export async function buildGroundedContext(): Promise<GroundedContext> {
  const findings = await prisma.finding.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: {
      owner: { select: { name: true } },
      team: { select: { name: true } },
      application: { select: { name: true } },
    },
  });

  const overdue = findings.filter((f) => getDaysRemaining(f.targetDate) < 0).length;
  const critical = findings.filter((f) => f.severity === 'CRITICAL').length;
  const blocked = findings.filter((f) => f.status === 'BLOCKED').length;
  const avgRisk = findings.length
    ? Math.round(findings.reduce((s, f) => s + f.recoveryScore, 0) / findings.length)
    : 0;

  const topFindings = [...findings]
    .sort((a, b) => b.recoveryScore - a.recoveryScore)
    .slice(0, 10)
    .map((f) => ({
      findingId: f.findingId,
      title: f.title,
      severity: f.severity,
      recoveryScore: Math.round(f.recoveryScore),
      daysRemaining: getDaysRemaining(f.targetDate),
    }));

  const teamStats: Record<string, { overdue: number; total: number }> = {};
  for (const f of findings) {
    const team = f.team?.name || 'Unassigned';
    if (!teamStats[team]) teamStats[team] = { overdue: 0, total: 0 };
    teamStats[team].total++;
    if (getDaysRemaining(f.targetDate) < 0) teamStats[team].overdue++;
  }

  const appRisk: Record<string, { count: number; score: number }> = {};
  for (const f of findings) {
    const app = f.application?.name || 'Unknown';
    if (!appRisk[app]) appRisk[app] = { count: 0, score: 0 };
    appRisk[app].count++;
    appRisk[app].score += f.recoveryScore;
  }

  return {
    summary: `${findings.length} open findings, ${critical} critical, ${overdue} overdue, ${blocked} blocked. Average recovery score: ${avgRisk}/100.`,
    metrics: { open: findings.length, critical, overdue, blocked, avgRisk },
    topFindings,
    teamStats: Object.entries(teamStats)
      .map(([name, v]) => ({ name, ...v, overdue: v.overdue }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 8),
    appRisks: Object.entries(appRisk)
      .map(([name, v]) => ({ name, count: v.count, avgRisk: Math.round(v.score / v.count) }))
      .sort((a, b) => b.avgRisk - a.avgRisk)
      .slice(0, 8),
  };
}

export async function askLLM(question: string, context: GroundedContext): Promise<{ answer: string; source: 'llm' | 'analytics' }> {
  const { config } = await import('../../../lib/config');

  if (!config.copilot.openaiApiKey) {
    return { answer: '', source: 'analytics' };
  }

  const systemPrompt = `You are Recover Copilot, an enterprise cyber recover assistant for a Tier 1 bank.
Answer ONLY based on the provided live data. Be concise, executive-ready, and actionable.
Never invent findings or metrics not in the context.`;

  const userPrompt = `Context:
${context.summary}

Top findings: ${JSON.stringify(context.topFindings.slice(0, 5))}
Team stats: ${JSON.stringify(context.teamStats.slice(0, 5))}
App risks: ${JSON.stringify(context.appRisks.slice(0, 5))}

Question: ${question}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.copilot.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.copilot.openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content;
    if (answer) return { answer, source: 'llm' };
  } catch (err) {
    console.error('[Copilot LLM]', err);
  }

  return { answer: '', source: 'analytics' };
}
