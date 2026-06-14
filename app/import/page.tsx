'use client';

import { useEffect, useState, useCallback } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';
import { PageHeader, LoadingSpinner } from '@/components/ui';
import { apiFetch, useAuthStore } from '@/lib/store';
import { toast } from '@/lib/toast';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportResult {
  batchId: string;
  fileName: string;
  totalRows: number;
  imported: number;
  errors: { row: number; error: string }[];
  findingIds: string[];
}

interface ImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  createdAt: string;
  importedBy: { name: string };
}

export default function ImportPage() {
  const { token } = useAuthStore();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBatches = useCallback(() => {
    apiFetch<ImportBatch[]>('/import/batches')
      .then(setBatches)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadBatches(); }, [loadBatches]);

  const uploadFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      return toast('Only .xlsx, .xls, and .csv files are supported', 'error');
    }

    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data);
      toast(`Imported ${data.imported} of ${data.totalRows} vulnerabilities`, data.errors.length ? 'warning' : 'success');
      loadBatches();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const downloadTemplate = () => {
    const headers = 'Finding ID,Title,Description,Severity,CVSS,Asset,Service,Application,Owner,Status,Date Identified,Target Date\n';
    const sample = 'CRH-SAMPLE-001,Outdated TLS on web server,Weak cipher suites detected,HIGH,7.5,web-prod-01,Windows,Customer Portal,engineer@bank.com,OPEN,2025-01-15,2025-03-15\n';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vulnerability-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ProtectedLayout>
      <PageHeader
        title="Import Vulnerabilities"
        description="Upload Excel or CSV vulnerability lists for automatic import and validation"
        actions={
          <button onClick={downloadTemplate} className="btn-secondary">
            <Download className="h-4 w-4" /> Download Template
          </button>
        }
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'card mb-8 flex flex-col items-center justify-center border-2 border-dashed py-16 transition-colors',
          dragging ? 'border-brand-500 bg-brand-500/5' : 'border-surface-300 dark:border-surface-700',
          uploading && 'opacity-60 pointer-events-none'
        )}
      >
        {uploading ? (
          <LoadingSpinner />
        ) : (
          <>
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/15">
              <Upload className="h-8 w-8 text-brand-500" />
            </div>
            <p className="mb-2 text-lg font-semibold">Drag & drop your vulnerability file</p>
            <p className="mb-4 text-sm text-surface-500">Supports .xlsx, .xls, and .csv formats</p>
            <label className="btn-primary cursor-pointer">
              <FileSpreadsheet className="h-4 w-4" /> Browse Files
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
              />
            </label>
          </>
        )}
      </div>

      {result && (
        <div className="card mb-8">
          <h3 className="mb-4 font-semibold">Import Results — {result.fileName}</h3>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-50 p-4 dark:bg-surface-800">
              <p className="text-2xl font-bold">{result.totalRows}</p>
              <p className="text-sm text-surface-500">Total Rows</p>
            </div>
            <div className="rounded-lg bg-green-500/10 p-4">
              <p className="text-2xl font-bold text-green-500">{result.imported}</p>
              <p className="text-sm text-surface-500">Imported</p>
            </div>
            <div className="rounded-lg bg-red-500/10 p-4">
              <p className="text-2xl font-bold text-red-400">{result.errors.length}</p>
              <p className="text-sm text-surface-500">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-red-400">
                <AlertCircle className="h-4 w-4" /> Validation Errors
              </p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-sm text-surface-600 dark:text-surface-400">
                  Row {e.row}: {e.error}
                </p>
              ))}
            </div>
          )}

          {result.imported > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              {result.imported} vulnerabilities imported. Use the Vulnerability Register to bulk-assign to SMEs.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <h3 className="mb-4 font-semibold">Recent Imports</h3>
        {loading ? <LoadingSpinner /> : batches.length === 0 ? (
          <p className="text-sm text-surface-500">No imports yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-800">
                  {['File', 'Imported By', 'Rows', 'Success', 'Errors', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium uppercase text-surface-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                {batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3 font-medium">{b.fileName}</td>
                    <td className="px-4 py-3">{b.importedBy.name}</td>
                    <td className="px-4 py-3">{b.totalRows}</td>
                    <td className="px-4 py-3 text-green-500">{b.successCount}</td>
                    <td className="px-4 py-3 text-red-400">{b.errorCount}</td>
                    <td className="px-4 py-3 text-xs">{new Date(b.createdAt).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
