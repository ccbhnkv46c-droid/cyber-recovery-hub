'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import {
  PageHeader, LoadingSpinner, SeverityBadge, StatusBadge, MetricCard,
} from '@/components/ui';
import { apiFetch, useAuthStore } from '@/lib/store';
import { formatDate, formatDateTime, slaStatusColor, escalationLabel, cn } from '@/lib/utils';
import { canEscalate, isAssignedOnlyRole, canViewAuditTrail } from '@/lib/rbac';
import { toast } from '@/lib/toast';
import {
  Clock, Shield, AlertTriangle, Paperclip, History,
  ArrowUp, Send, Save, CheckCircle, MessageSquare,
} from 'lucide-react';
import { TASK_STATUSES, STATUS_LABELS } from '@/lib/services';

const STATUSES = TASK_STATUSES;
const COMMENT_TYPES = [
  { value: 'COMMENT', label: 'Comment' },
  { value: 'NEXT_STEP', label: 'Next Steps' },
  { value: 'BLOCKER', label: 'Blocker' },
  { value: 'PROGRESS_UPDATE', label: 'Progress Update' },
  { value: 'EVIDENCE', label: 'Evidence Note' },
];

export default function FindingDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { user } = useAuthStore();
  const [finding, setFinding] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState('COMMENT');
  const [activeTab, setActiveTab] = useState('overview');
  const [editStatus, setEditStatus] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editBlocker, setEditBlocker] = useState('');
  const [editNextSteps, setEditNextSteps] = useState('');
  const [editProgress, setEditProgress] = useState(0);
  const [evidenceDesc, setEvidenceDesc] = useState('');
  const [evidenceFile, setEvidenceFile] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFinding = useCallback(() => {
    apiFetch<Record<string, unknown>>(`/findings/${id}`)
      .then((f) => {
        setFinding(f);
        setEditStatus(f.status as string);
        setEditPlan((f.remediationPlan as string) || '');
        setEditBlocker((f.blockerReason as string) || '');
        setEditNextSteps((f.nextSteps as string) || '');
        setEditProgress((f.progress as number) || 0);
      })
      .catch(() => toast('Failed to load finding', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { loadFinding(); }, [loadFinding]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    await apiFetch(`/findings/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: comment, type: commentType }),
    });
    setComment('');
    toast('Comment added', 'success');
    loadFinding();
  };

  const handleEscalate = async () => {
    try {
      await apiFetch(`/findings/${id}/escalate`, { method: 'POST', body: '{}' });
      toast('Finding escalated', 'success');
      loadFinding();
    } catch {
      toast('Escalation failed — insufficient permissions', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/findings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: editStatus,
          remediationPlan: editPlan,
          nextSteps: editNextSteps,
          progress: editProgress,
          blockerReason: editStatus === 'BLOCKED' ? editBlocker : undefined,
        }),
      });
      toast('Finding updated', 'success');
      loadFinding();
    } catch {
      toast('Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestExtension = async () => {
    const newDate = prompt('Requested new target date (YYYY-MM-DD):');
    if (!newDate) return;
    try {
      await apiFetch(`/findings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ requestExtension: true, newTargetDate: newDate, status: 'PENDING_REVIEW' }),
      });
      toast('Extension request submitted', 'success');
      loadFinding();
    } catch {
      toast('Request failed', 'error');
    }
  };

  const handleRequestException = async () => {
    const reason = prompt('Risk acceptance justification:');
    if (!reason) return;
    try {
      await apiFetch(`/findings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ requestException: true, exceptionReason: reason }),
      });
      toast('Exception request submitted', 'success');
      loadFinding();
    } catch {
      toast('Request failed', 'error');
    }
  };

  const handleEvidence = async () => {
    if (!evidenceDesc.trim()) return;
    try {
      await apiFetch(`/findings/${id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({ description: evidenceDesc, fileName: evidenceFile || 'remediation-evidence.pdf' }),
      });
      setEvidenceDesc('');
      setEvidenceFile('');
      toast('Evidence uploaded', 'success');
      loadFinding();
    } catch {
      toast('Evidence upload failed', 'error');
    }
  };

  const handleComplete = async () => {
    try {
      await apiFetch(`/findings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'REMEDIATED' }),
      });
      toast('Finding marked as remediated', 'success');
      loadFinding();
    } catch {
      toast('Failed to complete', 'error');
    }
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;
  if (!finding) return <ProtectedLayout><p>Finding not found</p></ProtectedLayout>;

  const f = finding;
  const isSme = isAssignedOnlyRole(user?.role || '');
  const isOwner = isSme ? f.ownerId === user?.id : true;
  const canEdit = isSme ? isOwner : user?.role === 'ADMIN' || ['SECURITY_ANALYST', 'TEAM_LEADER', 'ENGINEERING_MANAGER'].includes(user?.role || '');
  const showAudit = canViewAuditTrail(user?.role || '');
  const tabs = ['overview', 'actions', 'timeline', 'discussion', 'evidence', ...(showAudit ? ['audit'] : [])];
  const service = f.service as { name: string; businessArea: string } | undefined;
  const activities = (f.activities as { id: string; type: string; content: string; createdAt: string; user: { name: string; role: string } | null }[]) || [];
  const discussion = (f.comments as { id: string; content: string; type: string; user: { name: string; role: string }; createdAt: string }[]) || [];

  return (
    <ProtectedLayout>
      <PageHeader
        title={f.title as string}
        description={f.findingId as string}
        actions={
          <>
            {canEscalate(user?.role || '') && !isSme && (
              <button onClick={handleEscalate} className="btn-secondary">
                <ArrowUp className="h-4 w-4" /> Escalate
              </button>
            )}
            {canEdit && (
              <button onClick={handleComplete} className="btn-primary">
                <CheckCircle className="h-4 w-4" /> Mark Completed
              </button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-3">
        <SeverityBadge severity={f.severity as string} />
        <StatusBadge status={f.status as string} />
        <span className={cn('badge border', slaStatusColor(f.slaStatus as string))}>
          <Clock className="mr-1 h-3 w-3" />
          {(f.daysRemaining as number) < 0
            ? `${Math.abs(f.daysRemaining as number)} days overdue`
            : `${f.daysRemaining} days remaining`}
        </span>
        <span className="badge border border-surface-300 dark:border-surface-700">
          Service: {service?.name || '—'}
        </span>
        <span className="badge border border-surface-300 dark:border-surface-700">
          Escalation: {escalationLabel(f.escalationLevel as string)}
        </span>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="CVSS Score" value={(f.cvssScore as number).toFixed(1)} icon={Shield} />
        <MetricCard title="Recovery Score" value={Math.round(f.recoveryScore as number)} icon={AlertTriangle} color="red" />
        <MetricCard title="Risk Level" value={f.riskLevel as string} icon={Shield} color="orange" />
        <MetricCard title="Target Date" value={formatDate(f.targetDate as string)} icon={Clock} />
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'whitespace-nowrap px-4 py-2 text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="card">
              <h3 className="mb-3 font-semibold">Description</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">{f.description as string}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="card">
                <h3 className="mb-3 font-semibold">Business Impact</h3>
                <p className="text-sm text-surface-600 dark:text-surface-400">{f.businessImpact as string}</p>
              </div>
              <div className="card">
                <h3 className="mb-3 font-semibold">Technical Impact</h3>
                <p className="text-sm text-surface-600 dark:text-surface-400">{f.technicalImpact as string}</p>
              </div>
            </div>
            <div className="card">
              <h3 className="mb-3 font-semibold">Mitigation</h3>
              <p className="text-sm text-surface-600 dark:text-surface-400">{f.mitigation as string}</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="card">
              <h3 className="mb-4 font-semibold">Risk Scoring</h3>
              <div className="space-y-3">
                {[
                  ['Technical Risk', f.technicalRisk],
                  ['Business Risk', f.businessRisk],
                  ['Exploitability', f.exploitability],
                  ['Likelihood', f.likelihood],
                ].map(([label, val]) => (
                  <div key={label as string}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-surface-500">{label as string}</span>
                      <span className="font-medium">{Math.round(val as number)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700">
                      <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, val as number)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="mb-4 font-semibold">Due Dates & SLA</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ['Date Identified', f.dateIdentified],
                  ['Date Assigned', f.assignedAt],
                  ['SLA Target Date', f.targetDate],
                  ['Planned Completion', f.plannedCompletionDate],
                  ['Actual Completion', f.actualCompletionDate],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <dt className="text-surface-500">{k as string}</dt>
                    <dd className="font-medium">{v ? formatDate(v as string) : '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="card">
              <h3 className="mb-4 font-semibold">Assignment</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ['Assigned To', (f.owner as { name: string })?.name],
                  ['Assigned By', (f.assignedBy as { name: string })?.name],
                  ['Team', (f.team as { name: string })?.name],
                  ['Manager', (f.manager as { name: string })?.name],
                  ['Service', service?.name],
                  ['Application', (f.application as { name: string })?.name],
                  ['Technology', f.technology],
                  ['Asset', f.asset],
                  ['Business Area', f.businessArea],
                  ['Priority', f.priority],
                  ['Progress', `${f.progress || 0}%`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between">
                    <dt className="text-surface-500">{k as string}</dt>
                    <dd className="font-medium">{(v as string) || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'actions' && canEdit && (
        <div className="card max-w-2xl space-y-4">
          <h3 className="font-semibold">Remediation Actions</h3>
          <div>
            <label className="mb-1 block text-sm text-surface-500">Status</label>
            <select className="input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-surface-500">Progress ({editProgress}%)</label>
            <input type="range" min={0} max={100} className="w-full" value={editProgress} onChange={(e) => setEditProgress(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-surface-500">Next Steps</label>
            <textarea className="input min-h-[80px]" value={editNextSteps} onChange={(e) => setEditNextSteps(e.target.value)} placeholder="What needs to happen next..." />
          </div>
          {editStatus === 'BLOCKED' && (
            <div>
              <label className="mb-1 block text-sm text-surface-500">Blocker Reason</label>
              <input className="input" value={editBlocker} onChange={(e) => setEditBlocker(e.target.value)} placeholder="Describe the blocker..." />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-surface-500">Remediation Plan</label>
            <textarea className="input min-h-[120px]" value={editPlan} onChange={(e) => setEditPlan(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={handleRequestExtension} className="btn-secondary">Request Extension</button>
            <button onClick={handleRequestException} className="btn-secondary">Request Exception</button>
          </div>
        </div>
      )}

      {activeTab === 'discussion' && (
        <div className="card">
          <div className="mb-4 flex flex-wrap gap-2">
            <select className="input w-40" value={commentType} onChange={(e) => setCommentType(e.target.value)}>
              {COMMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="input flex-1" placeholder="Add to discussion history..." value={comment} onChange={(e) => setComment(e.target.value)} />
            <button onClick={handleComment} className="btn-primary"><Send className="h-4 w-4" /></button>
          </div>
          <div className="space-y-4">
            {[...discussion].reverse().map((c) => (
              <div key={c.id} className="rounded-lg border border-surface-200 p-4 dark:border-surface-800">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.user.name}</span>
                    <span className="badge bg-surface-500/10 text-xs text-surface-500">{c.type.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-xs text-surface-500">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="text-sm text-surface-600 dark:text-surface-400">{c.content}</p>
              </div>
            ))}
            {discussion.length === 0 && (
              <p className="py-8 text-center text-sm text-surface-500">
                <MessageSquare className="mx-auto mb-2 h-6 w-6" />
                No discussion history yet
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="card">
          {canEdit && (
            <div className="mb-4 flex gap-2">
              <input className="input flex-1" placeholder="Evidence description..." value={evidenceDesc} onChange={(e) => setEvidenceDesc(e.target.value)} />
              <input className="input w-48" placeholder="Filename" value={evidenceFile} onChange={(e) => setEvidenceFile(e.target.value)} />
              <button onClick={handleEvidence} className="btn-primary"><Paperclip className="h-4 w-4" /></button>
            </div>
          )}
          <div className="space-y-3">
            {((f.evidence as { id: string; description: string; fileName: string; user: { name: string }; createdAt: string; verified: boolean }[]) || []).map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-lg border border-surface-200 p-3 dark:border-surface-800">
                <Paperclip className="h-4 w-4 text-surface-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.fileName}</p>
                  <p className="text-xs text-surface-500">{e.description} — {e.user.name} — {formatDateTime(e.createdAt)}</p>
                </div>
                <span className={cn('badge', e.verified ? 'bg-green-500/15 text-green-400' : 'bg-surface-500/15 text-surface-400')}>
                  {e.verified ? 'Verified' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div className="space-y-2">
            {((f.auditLogs as { id: string; action: string; user: { name: string }; createdAt: string }[]) || []).map((log) => (
              <div key={log.id} className="flex items-start gap-3 border-b border-surface-100 py-3 last:border-0 dark:border-surface-800">
                <History className="mt-0.5 h-4 w-4 text-surface-400" />
                <div className="flex-1">
                  <p className="text-sm"><span className="font-medium">{log.user?.name || 'System'}</span> — {log.action}</p>
                  <p className="text-xs text-surface-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card">
          <div className="space-y-0">
            {[...activities].reverse().map((a, i) => (
              <div key={a.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'h-3 w-3 rounded-full',
                    a.type === 'COMPLETED' ? 'bg-green-500'
                    : a.type === 'BLOCKER' ? 'bg-red-500'
                    : a.type === 'ASSIGNED' ? 'bg-blue-500'
                    : 'bg-brand-500'
                  )} />
                  {i < activities.length - 1 && <div className="w-px flex-1 bg-surface-200 dark:bg-surface-700" />}
                </div>
                <div className="pb-6">
                  <p className="text-sm font-medium">{a.type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-surface-500">
                    {a.user?.name || 'System'} — {formatDateTime(a.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">{a.content}</p>
                </div>
              </div>
            ))}
            {activities.length === 0 && (
              <div className="flex gap-4">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium">Finding Created</p>
                  <p className="text-xs text-surface-500">{formatDateTime(f.createdAt as string)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}
