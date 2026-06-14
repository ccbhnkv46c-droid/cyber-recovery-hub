import { Router, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import prisma from '../../lib/prisma';
import {
  calculateRiskScore, calculateTargetDate, SLA_DAYS, Severity,
} from '../../lib/constants';
import { normalizeSeverity, normalizeStatus, ACTIVITY_TYPES } from '../../lib/services';
import { authMiddleware, requireRoles, AuthRequest } from '../middleware/auth';
import { recordActivity } from '../services/findings/activity';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const COLUMN_MAP: Record<string, string> = {
  'finding id': 'findingId', 'finding_id': 'findingId', 'id': 'findingId',
  'title': 'title', 'name': 'title', 'vulnerability': 'title',
  'description': 'description', 'desc': 'description',
  'severity': 'severity', 'risk': 'severity',
  'cvss': 'cvssScore', 'cvss score': 'cvssScore', 'cvss_score': 'cvssScore',
  'asset': 'asset', 'hostname': 'asset', 'host': 'asset',
  'service': 'serviceName', 'service name': 'serviceName',
  'application': 'applicationName', 'app': 'applicationName',
  'owner': 'ownerEmail', 'assigned to': 'ownerEmail', 'sme': 'ownerEmail',
  'status': 'status',
  'date identified': 'dateIdentified', 'identified': 'dateIdentified', 'created': 'dateIdentified',
  'target date': 'targetDate', 'due date': 'targetDate', 'due': 'targetDate',
  'business area': 'businessArea', 'business_area': 'businessArea',
  'technology': 'technology',
};

function mapRow(row: Record<string, unknown>): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const norm = key.toLowerCase().trim();
    const field = COLUMN_MAP[norm];
    if (field && val != null) mapped[field] = String(val).trim();
  }
  return mapped;
}

function parseFile(buffer: Buffer, fileName: string): Record<string, unknown>[] {
  if (fileName.endsWith('.csv')) {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, unknown> = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ''; });
      return row;
    });
  }
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
}

router.post('/upload', authMiddleware, requireRoles('ADMIN'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileName = req.file.originalname;
  if (!fileName.match(/\.(xlsx|xls|csv)$/i)) {
    return res.status(400).json({ error: 'Only .xlsx, .xls, and .csv files are supported' });
  }

  const rows = parseFile(req.file.buffer, fileName);
  if (rows.length === 0) return res.status(400).json({ error: 'File contains no data rows' });

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      importedById: req.user!.id,
      totalRows: rows.length,
    },
  });

  const services = await prisma.service.findMany();
  const serviceMap = Object.fromEntries(services.map((s) => [s.name.toLowerCase(), s.id]));
  const users = await prisma.user.findMany({ where: { role: { in: ['SME', 'ENGINEER'] } } });
  const userMap = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), u.id]));

  const errors: { row: number; error: string }[] = [];
  const imported: string[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const mapped = mapRow(rows[i]);
    const rowNum = i + 2;

    if (!mapped.title) {
      errors.push({ row: rowNum, error: 'Title is required' });
      continue;
    }

    const severity = normalizeSeverity(mapped.severity || 'MEDIUM') as Severity;
    const serviceName = mapped.serviceName || 'Windows';
    const serviceId = serviceMap[serviceName.toLowerCase()];

    if (!serviceId) {
      errors.push({ row: rowNum, error: `Unknown service: ${serviceName}` });
      continue;
    }

    const cvssScore = parseFloat(mapped.cvssScore || '5') || 5;
    const risk = calculateRiskScore({ cvssScore, exploitability: 5, likelihood: 5, exposure: 5, criticality: 5 });

    const dateIdentified = mapped.dateIdentified ? new Date(mapped.dateIdentified) : new Date();
    const targetDate = mapped.targetDate ? new Date(mapped.targetDate) : calculateTargetDate(severity, dateIdentified);

    const findingId = mapped.findingId || `CRH-IMP-${batch.id.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`;

    const existing = await prisma.finding.findUnique({ where: { findingId } });
    if (existing) {
      errors.push({ row: rowNum, error: `Duplicate finding ID: ${findingId}` });
      continue;
    }

    const ownerId = mapped.ownerEmail ? userMap[mapped.ownerEmail.toLowerCase()] : undefined;

    try {
      const finding = await prisma.finding.create({
        data: {
          findingId,
          title: mapped.title,
          description: mapped.description || mapped.title,
          severity,
          cvssScore,
          ...risk,
          serviceId,
          asset: mapped.asset,
          technology: mapped.technology,
          businessArea: mapped.businessArea,
          status: normalizeStatus(mapped.status || 'OPEN'),
          ownerId,
          assignedById: ownerId ? req.user!.id : undefined,
          assignedAt: ownerId ? new Date() : undefined,
          dateIdentified,
          targetDate,
          slaDays: SLA_DAYS[severity],
          importBatchId: batch.id,
        },
      });

      await recordActivity({
        findingId: finding.id,
        userId: req.user!.id,
        type: ACTIVITY_TYPES.IMPORTED,
        content: `Imported from ${fileName}`,
        metadata: { row: rowNum, batchId: batch.id },
      });

      imported.push(findingId);
      successCount++;
    } catch (err) {
      errors.push({ row: rowNum, error: (err as Error).message });
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      successCount,
      errorCount: errors.length,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });

  res.json({
    batchId: batch.id,
    fileName,
    totalRows: rows.length,
    imported: successCount,
    errors,
    findingIds: imported,
  });
});

router.get('/batches', authMiddleware, async (_req, res: Response) => {
  const batches = await prisma.importBatch.findMany({
    include: { importedBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(batches);
});

export default router;
