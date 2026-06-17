'use client';

import { useEffect, useState } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch, useAuthStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Plus, Pencil, HardDrive, Globe, Shield, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ASSET_TYPES, ASSET_ENVIRONMENTS, DATA_CLASSIFICATIONS, BUSINESS_CRITICALITY_LEVELS,
  CRITICALITY_COLORS, ENVIRONMENT_LABELS,
} from '@/lib/assets';

interface Asset {
  id: string;
  name: string;
  assetType: string;
  hostingLocation: string | null;
  environment: string;
  internetFacing: boolean;
  criticalService: boolean;
  dataClassification: string | null;
  businessCriticality: string;
  owner: string | null;
  service: { id: string; name: string; businessArea: string | null };
  application: { id: string; name: string } | null;
  businessOwner: { id: string; name: string } | null;
  technicalOwner: { id: string; name: string } | null;
  sme: { id: string; name: string } | null;
  openFindings: number;
  overdueFindings: number;
  criticalFindings: number;
  _count: { findings: number };
}

interface ServiceOption { id: string; name: string; businessArea: string | null }
interface AppOption { id: string; name: string }
interface UserOption { id: string; name: string; role?: string }

const emptyForm = {
  name: '', assetType: 'Server', hostingLocation: '', environment: 'PRODUCTION',
  internetFacing: false, criticalService: false, dataClassification: 'Internal',
  businessCriticality: 'MEDIUM', owner: '', serviceId: '', applicationId: '',
  businessOwnerId: '', technicalOwnerId: '', smeId: '',
};

export default function AssetsPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [applications, setApplications] = useState<AppOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filterService, setFilterService] = useState('');
  const [search, setSearch] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (filterService) params.set('serviceId', filterService);
    if (search) params.set('search', search);
    apiFetch<Asset[]>(`/assets?${params}`)
      .then(setAssets)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterService, search]);
  useEffect(() => {
    Promise.all([
      apiFetch<ServiceOption[]>('/services'),
      apiFetch<{ applications: AppOption[]; owners: UserOption[] }>('/admin/filters'),
    ]).then(([svc, filters]) => {
      setServices(svc);
      setApplications(filters.applications);
      setUsers(filters.owners);
    }).catch(console.error);
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return toast('Asset name is required', 'error');
    if (!form.serviceId) return toast('Service is required', 'error');
    try {
      const payload = {
        ...form,
        internetFacing: form.internetFacing,
        criticalService: form.criticalService,
        applicationId: form.applicationId || null,
        businessOwnerId: form.businessOwnerId || null,
        technicalOwnerId: form.technicalOwnerId || null,
        smeId: form.smeId || null,
      };
      if (editing) {
        await apiFetch(`/assets/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        toast('Asset updated', 'success');
      } else {
        await apiFetch('/assets', { method: 'POST', body: JSON.stringify(payload) });
        toast('Asset created', 'success');
      }
      resetForm();
      load();
    } catch {
      toast('Failed to save asset', 'error');
    }
  };

  const startEdit = (asset: Asset) => {
    setEditing(asset);
    setForm({
      name: asset.name,
      assetType: asset.assetType,
      hostingLocation: asset.hostingLocation || '',
      environment: asset.environment,
      internetFacing: asset.internetFacing,
      criticalService: asset.criticalService,
      dataClassification: asset.dataClassification || 'Internal',
      businessCriticality: asset.businessCriticality,
      owner: asset.owner || '',
      serviceId: asset.service.id,
      applicationId: asset.application?.id || '',
      businessOwnerId: asset.businessOwner?.id || '',
      technicalOwnerId: asset.technicalOwner?.id || '',
      smeId: asset.sme?.id || '',
    });
    setShowForm(true);
  };

  if (loading) return <ProtectedLayout><LoadingSpinner /></ProtectedLayout>;

  const criticalWithVulns = assets.filter((a) => a.businessCriticality === 'CRITICAL' && a.openFindings > 0).length;
  const internetFacingWithVulns = assets.filter((a) => a.internetFacing && a.openFindings > 0).length;
  const overdueAssets = assets.filter((a) => a.overdueFindings > 0).length;

  return (
    <ProtectedLayout>
      <PageHeader
        title="Asset Register"
        description={isAdmin
          ? 'Manage business assets and link vulnerabilities to services, applications and owners'
          : 'Assets linked to vulnerabilities assigned to you'}
        actions={isAdmin ? (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus className="h-4 w-4" /> New Asset
          </button>
        ) : undefined}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-500/15">
            <HardDrive className="h-6 w-6 text-brand-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{assets.length}</p>
            <p className="text-sm text-surface-500">Total Assets</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/15">
            <Shield className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{criticalWithVulns}</p>
            <p className="text-sm text-surface-500">Critical Assets with Open Vulns</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/15">
            <Globe className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{internetFacingWithVulns}</p>
            <p className="text-sm text-surface-500">Internet-Facing with Open Vulns</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/15">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
          </div>
          <div>
            <p className="text-2xl font-bold">{overdueAssets}</p>
            <p className="text-sm text-surface-500">Assets with Overdue Remediation</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:w-64" value={filterService} onChange={(e) => setFilterService(e.target.value)}>
          <option value="">All Services</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showForm && isAdmin && (
        <div className="card mb-6">
          <h3 className="mb-4 font-semibold">{editing ? 'Edit Asset' : 'Create Asset'}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input className="input" placeholder="Asset name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.assetType} onChange={(e) => setForm({ ...form, assetType: e.target.value })}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="input" value={form.serviceId} onChange={(e) => setForm({ ...form, serviceId: e.target.value })}>
              <option value="">Select Service</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}>
              <option value="">Application (optional)</option>
              {applications.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input className="input" placeholder="Hosting location" value={form.hostingLocation} onChange={(e) => setForm({ ...form, hostingLocation: e.target.value })} />
            <select className="input" value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
              {ASSET_ENVIRONMENTS.map((e) => <option key={e} value={e}>{ENVIRONMENT_LABELS[e]}</option>)}
            </select>
            <select className="input" value={form.dataClassification} onChange={(e) => setForm({ ...form, dataClassification: e.target.value })}>
              {DATA_CLASSIFICATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="input" value={form.businessCriticality} onChange={(e) => setForm({ ...form, businessCriticality: e.target.value })}>
              {BUSINESS_CRITICALITY_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Business owner (name)" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
            <select className="input" value={form.smeId} onChange={(e) => setForm({ ...form, smeId: e.target.value })}>
              <option value="">SME (optional)</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select className="input" value={form.technicalOwnerId} onChange={(e) => setForm({ ...form, technicalOwnerId: e.target.value })}>
              <option value="">Technical owner (optional)</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.internetFacing} onChange={(e) => setForm({ ...form, internetFacing: e.target.checked })} />
              Internet facing
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.criticalService} onChange={(e) => setForm({ ...form, criticalService: e.target.checked })} />
              Critical service
            </label>
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
                {['Asset', 'Type', 'Service', 'Application', 'Environment', 'Exposure', 'Criticality', 'SME', 'Open Vulns', 'Overdue', ''].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/30">
                  <td className="px-4 py-3 font-medium">{asset.name}</td>
                  <td className="px-4 py-3 text-xs">{asset.assetType}</td>
                  <td className="px-4 py-3 text-xs">{asset.service.name}</td>
                  <td className="px-4 py-3 text-xs">{asset.application?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs">{ENVIRONMENT_LABELS[asset.environment] || asset.environment}</td>
                  <td className="px-4 py-3 text-xs">
                    {asset.internetFacing ? (
                      <span className="badge bg-orange-500/15 text-orange-400">Internet Facing</span>
                    ) : (
                      <span className="badge bg-surface-500/15 text-surface-400">Internal</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge', CRITICALITY_COLORS[asset.businessCriticality])}>
                      {asset.businessCriticality}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{asset.sme?.name || '—'}</td>
                  <td className="px-4 py-3 text-center font-medium text-brand-600">{asset.openFindings}</td>
                  <td className="px-4 py-3 text-center">
                    {asset.overdueFindings > 0 ? (
                      <span className="font-medium text-red-500">{asset.overdueFindings}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <button onClick={() => startEdit(asset)} className="btn-ghost">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {assets.length === 0 && (
        <p className="mt-4 text-center text-sm text-surface-500">No assets found.</p>
      )}
    </ProtectedLayout>
  );
}
