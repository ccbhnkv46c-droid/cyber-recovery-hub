'use client';

import { useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { BRAND } from '@/lib/branding';
import { Bot, Send, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'What should I chase today?',
  'Which applications create the highest risk?',
  'Which teams consistently miss SLAs?',
  'Predict which findings will become overdue',
  'Suggest remediation priorities',
  'Generate executive summary',
];

interface CopilotResponse {
  question: string;
  answer: string;
  data: Record<string, unknown>[] | Record<string, unknown> | null;
  generatedAt: string;
}

export default function CopilotPage() {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<CopilotResponse[]>([]);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch<CopilotResponse>('/copilot/ask', {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      });
      setResponse(res);
      setHistory((h) => [res, ...h].slice(0, 10));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedLayout>
      <PageHeader
        title={BRAND.copilotName}
        description="Intelligent recover analytics — prioritisation, risk analysis, and executive reporting"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card min-h-[500px] flex flex-col">
            <div className="mb-4 flex items-center gap-3 border-b border-surface-200 pb-4 dark:border-surface-800">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-display font-semibold">{BRAND.copilotName}</p>
                <p className="text-xs text-surface-500">Grounded in live finding data and SLA analytics</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
              {history.length === 0 && !response && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="mb-4 h-12 w-12 text-brand-400" />
                  <p className="text-lg font-medium">How can I help with {BRAND.functionName.toLowerCase()} today?</p>
                  <p className="mt-2 max-w-md text-sm text-surface-500">
                    Ask about priorities, risk analysis, SLA performance, or request executive reports.
                  </p>
                </div>
              )}

              {history.map((h, i) => (
                <div key={i} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-xl bg-brand-600 px-4 py-2 text-sm text-white">
                      {h.question}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Bot className="mt-1 h-5 w-5 shrink-0 text-brand-500" />
                    <div className="max-w-[85%] rounded-xl bg-surface-100 px-4 py-3 text-sm dark:bg-surface-800">
                      <pre className="whitespace-pre-wrap font-sans">{h.answer}</pre>
                      {h.data && Array.isArray(h.data) && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
                          <table className="w-full text-xs">
                            <tbody>
                              {(h.data as Record<string, unknown>[]).slice(0, 8).map((row, ri) => (
                                <tr key={ri} className="border-b border-surface-200 last:border-0 dark:border-surface-700">
                                  {Object.values(row).map((val, vi) => (
                                    <td key={vi} className="px-2 py-1">{String(val)}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <Bot className="h-5 w-5 text-brand-500" />
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2 border-t border-surface-200 pt-4 dark:border-surface-800">
              <input
                className="input flex-1"
                placeholder={`Ask ${BRAND.copilotName}...`}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ask(question)}
              />
              <button onClick={() => ask(question)} className="btn-primary" disabled={loading}>
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-3 font-semibold">Suggested Questions</h3>
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuestion(s); ask(s); }}
                  className="w-full rounded-lg border border-surface-200 p-3 text-left text-sm transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
