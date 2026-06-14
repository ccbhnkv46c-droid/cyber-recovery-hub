'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Plus, Pencil, Server, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  criticality: string;
  businessArea: string | null;
  isActive: boolean;
  _count: { findings: number };
}

const CRITICALITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-400',
  HIGH: 'bg-orange-500/15 text-orange-400',
  MEDIUM: 'bg-yellow-500/15 text-yellow-400',
  LOW: 'bg-green-500/15 text-green-400',
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Service | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', owner: '', criticality: 'MEDIUM', businessArea: '',
  });

  const load = () => {
    apiFetch<Service[]>('/services')
      .then(setServices)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', owner: '', criticality: 'MEDIUM', businessArea: '' });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Service name is required', 'error');
    try {
      if (editing) {
        await apiFetch(`/services/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        toast('Service updated', 'success');
      } else {
        await apiFetch('/services', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast('Service created', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Failed to save service', 'error');
    }
  };

  const startEdit = (svc: Service) => {
    setEditing(svc);
    setForm({
      name: svc.name,
      description: svc.description || '',
      owner: svc.owner || '',
      criticality: svc.criticality,
      businessArea: svc.businessArea || '',
    });
    setShowForm(true);
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Services"
        description="Manage technology services — every vulnerability must belong to a service"
        actions={
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> New Service
          </button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500/15">
            <Server className="h-6 w-6 text-brand-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{services.length}</p>
            <p className="text-sm text-surface-500">Active Services</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/15">
            <Shield className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {services.reduce((s, svc) => s + svc._count.findings, 0)}
            </p>
            <p className="text-sm text-surface-500">Total Vulnerabilities</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/15">
            <Shield className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">
              {services.filter((s) => s.criticality === 'CRITICAL' || s.criticality === 'HIGH').length}
            </p>
            <p className="text-sm text-surface-500">High-Criticality Services</p>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h3 className="mb-4 font-semibold">{editing ? 'Edit Service' : 'Create Service'}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="input" placeholder="Service name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            <input className="input" placeholder="Business area" value={form.businessArea} onChange={(e) => setForm({ ...form, businessArea: e.target.value })} />
            <select className="input" value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea className="input sm:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={handleSubmit} className="btn-primary">{editing ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((svc) => (
          <div key={svc.id} className="card group transition-shadow hover:shadow-md">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{svc.name}</h3>
                <p className="text-xs text-surface-500">{svc.businessArea || 'General'}</p>
              </div>
              <button onClick={() => startEdit(svc)} className="btn-ghost opacity-0 transition-opacity group-hover:opacity-100">
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 line-clamp-2 text-sm text-surface-500">{svc.description || 'No description'}</p>
            <div className="flex items-center justify-between">
              <span className={cn('badge', CRITICALITY_COLORS[svc.criticality] || CRITICALITY_COLORS.MEDIUM)}>
                {svc.criticality}
              </span>
              <span className="text-sm font-medium text-brand-600">{svc._count.findings} findings</span>
            </div>
            {svc.owner && <p className="mt-2 text-xs text-surface-500">Owner: {svc.owner}</p>}
          </div>
        ))}
      </div>
    </ProtectedLayout>
  );
}
