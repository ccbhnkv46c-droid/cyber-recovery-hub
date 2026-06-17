'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch, useAuthStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Plus, Pencil, Trash2, Radar, Download, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EXPLOIT_MATURITY_LEVELS, INTELLIGENCE_CONFIDENCE_LEVELS, CONFIDENCE_COLORS,
} from '@/lib/threat-intel';

interface ThreatRecord {
  id: string;
  cve: string;
  threatName: string;
  threatSource: string;
  activeExploitation: boolean;
  publicExploitAvailable: boolean;
  ransomwareAssociated: boolean;
  malwareAssociated: boolean;
  threatActorAssociated: string | null;
  exploitMaturity: string | null;
  dateFirstSeen: string | null;
  intelligenceConfidence: string;
  sourceReference: string | null;
  recommendedAction: string | null;
  lastUpdated: string;
  linkedFindings?: number;
}

const emptyForm = {
  cve: '', threatName: '', threatSource: '', activeExploitation: false,
  publicExploitAvailable: false, ransomwareAssociated: false, malwareAssociated: false,
  threatActorAssociated: '', exploitMaturity: 'POC', dateFirstSeen: '',
  intelligenceConfidence: 'MEDIUM', sourceReference: '', recommendedAction: '',
};

export default function ThreatIntelligencePage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [records, setRecords] = useState<ThreatRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ThreatRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [seeding, setSeeding] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    apiFetch<ThreatRecord[]>(`/threat-intel?${params}`)
      .then(setRecords)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.cve.trim()) return toast('CVE is required', 'error');
    if (!form.threatName.trim()) return toast('Threat name is required', 'error');
    try {
      const payload = { ...form, threatActorAssociated: form.threatActorAssociated || null };
      if (editing) {
        await apiFetch(`/threat-intel/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Threat intelligence updated', 'success');
      } else {
        await apiFetch('/threat-intel', { method: 'POST', body: JSON.stringify(payload) });
        toast('Threat intelligence created', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Failed to save threat intelligence', 'error');
    }
  };

  const handleDelete = async (record: ThreatRecord) => {
    if (!confirm(`Delete threat intelligence for ${record.cve}?`)) return;
    try {
      await apiFetch(`/threat-intel/${record.id}`, { method: 'DELETE' });
      toast('Record deleted', 'success');
      load();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  const importDemo = async () => {
    setSeeding(true);
    try {
      const res = await apiFetch<{ created: number; skipped: number }>('/threat-intel/seed-demo', { method: 'POST', body: '{}' });
      toast(`Imported ${res.created} records (${res.skipped} already existed)`, 'success');
      load();
    } catch {
      toast('Demo import failed', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const startEdit = (record: ThreatRecord) => {
    setEditing(record);
    setForm({
      cve: record.cve,
      threatName: record.threatName,
      threatSource: record.threatSource,
      activeExploitation: record.activeExploitation,
      publicExploitAvailable: record.publicExploitAvailable,
      ransomwareAssociated: record.ransomwareAssociated,
      malwareAssociated: record.malwareAssociated,
      threatActorAssociated: record.threatActorAssociated || '',
      exploitMaturity: record.exploitMaturity || 'POC',
      dateFirstSeen: record.dateFirstSeen ? record.dateFirstSeen.split('T')[0] : '',
      intelligenceConfidence: record.intelligenceConfidence,
      sourceReference: record.sourceReference || '',
      recommendedAction: record.recommendedAction || '',
    });
    setShowForm(true);
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const activeCount = records.filter((r) => r.activeExploitation).length;
  const exploitCount = records.filter((r) => r.publicExploitAvailable).length;
  const ransomwareCount = records.filter((r) => r.ransomwareAssociated).length;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Threat Intelligence"
        description={isAdmin
          ? 'Manage threat intelligence records and link to vulnerabilities by CVE'
          : 'Threat intelligence for vulnerabilities assigned to you'}
        actions={isAdmin ? (
          <div className="flex gap-2">
            <button onClick={importDemo} disabled={seeding} className="btn-secondary">
              <Download className="h-4 w-4" /> {seeding ? 'Importing...' : 'Import Demo Data'}
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
              <Plus className="h-4 w-4" /> New Record
            </button>
          </div>
        ) : undefined}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500/15">
            <Radar className="h-6 w-6 text-brand-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{records.length}</p>
            <p className="text-sm text-surface-500">Intel Records</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/15">
            <ShieldAlert className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-sm text-surface-500">Active Exploitation</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/15">
            <ShieldAlert className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{exploitCount}</p>
            <p className="text-sm text-surface-500">Public Exploits</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/15">
            <ShieldAlert className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{ransomwareCount}</p>
            <p className="text-sm text-surface-500">Ransomware Linked</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="input w-full max-w-md"
          placeholder="Search CVE, threat name, actor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {showForm && isAdmin && (
        <div className="card mb-6">
          <h3 className="mb-4 font-semibold">{editing ? 'Edit Threat Intelligence' : 'Create Threat Intelligence'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input className="input" placeholder="CVE (e.g. CVE-2024-3400)" value={form.cve} disabled={!!editing} onChange={(e) => setForm({ ...form, cve: e.target.value })} />
            <input className="input sm:col-span-2" placeholder="Threat name" value={form.threatName} onChange={(e) => setForm({ ...form, threatName: e.target.value })} />
            <input className="input sm:col-span-2" placeholder="Threat source" value={form.threatSource} onChange={(e) => setForm({ ...form, threatSource: e.target.value })} />
            <input className="input" placeholder="Threat actor" value={form.threatActorAssociated} onChange={(e) => setForm({ ...form, threatActorAssociated: e.target.value })} />
            <select className="input" value={form.exploitMaturity} onChange={(e) => setForm({ ...form, exploitMaturity: e.target.value })}>
              {EXPLOIT_MATURITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select className="input" value={form.intelligenceConfidence} onChange={(e) => setForm({ ...form, intelligenceConfidence: e.target.value })}>
              {INTELLIGENCE_CONFIDENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <input className="input" type="date" value={form.dateFirstSeen} onChange={(e) => setForm({ ...form, dateFirstSeen: e.target.value })} />
            <input className="input sm:col-span-2" placeholder="Source reference URL" value={form.sourceReference} onChange={(e) => setForm({ ...form, sourceReference: e.target.value })} />
            <textarea className="input sm:col-span-3" placeholder="Recommended action" value={form.recommendedAction} onChange={(e) => setForm({ ...form, recommendedAction: e.target.value })} />
            {[
              ['activeExploitation', 'Active exploitation'],
              ['publicExploitAvailable', 'Public exploit available'],
              ['ransomwareAssociated', 'Ransomware associated'],
              ['malwareAssociated', 'Malware associated'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form[key as keyof typeof form] as boolean} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSubmit} className="btn-primary">{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-800/50">
                {['CVE', 'Threat', 'Source', 'Flags', 'Actor', 'Confidence', 'Linked', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{record.cve}</td>
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="font-medium">{record.threatName}</p>
                    {record.recommendedAction && (
                      <p className="mt-1 line-clamp-2 text-xs text-surface-500">{record.recommendedAction}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{record.threatSource}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {record.activeExploitation && <span className="badge bg-red-500/15 text-red-400">Active</span>}
                      {record.publicExploitAvailable && <span className="badge bg-orange-500/15 text-orange-400">Exploit</span>}
                      {record.ransomwareAssociated && <span className="badge bg-purple-500/15 text-purple-400">Ransomware</span>}
                      {record.malwareAssociated && <span className="badge bg-yellow-500/15 text-yellow-400">Malware</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">{record.threatActorAssociated || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', CONFIDENCE_COLORS[record.intelligenceConfidence])}>
                      {record.intelligenceConfidence}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{record.linkedFindings ?? 0}</td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(record)} className="btn-ghost"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => handleDelete(record)} className="btn-ghost text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {records.length === 0 && (
        <p className="mt-4 text-center text-sm text-surface-500">
          {isAdmin ? 'No threat intelligence records. Import demo data or create a record.' : 'No threat intelligence linked to your assigned vulnerabilities.'}
        </p>
      )}
    </ProtectedLayout>
  );
}
