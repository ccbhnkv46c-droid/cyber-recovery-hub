import { Router, Response } from 'express';
import multer from 'multer';
import { authMiddleware, auditLog, AuthRequest } from '../middleware/auth';
import { getStorageAdapter, getLocalStorage } from '../services/storage/adapter';
import { scanFile } from '../services/storage/scan';
import prisma from '../../lib/prisma';
import fs from 'fs';
import path from 'path';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/:key', async (req, res: Response) => {
  const local = getLocalStorage();
  if (!local) return res.status(404).json({ error: 'File storage not available' });

  const filePath = local.getFilePath(req.params.key);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(path.resolve(filePath));
});

router.post('/evidence/:findingId', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const findingId = String(req.params.findingId);
  const finding = await prisma.finding.findFirst({
    where: { OR: [{ id: findingId }, { findingId }] },
  });
  if (!finding) return res.status(404).json({ error: 'Finding not found' });

  if (req.user!.role === 'ENGINEER' && finding.ownerId !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const scan = await scanFile(req.file.buffer, req.file.originalname);
  if (!scan.clean) {
    return res.status(400).json({ error: `File rejected: ${scan.threat}` });
  }

  const storage = getStorageAdapter();
  const stored = await storage.save(req.file.buffer, req.file.originalname, req.file.mimetype);

  const [evidence, attachment] = await Promise.all([
    prisma.evidence.create({
      data: {
        findingId: finding.id,
        userId: req.user!.id,
        description: req.body.description || 'Remediation evidence',
        fileName: req.file.originalname,
      },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.attachment.create({
      data: {
        findingId: finding.id,
        userId: req.user!.id,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        url: stored.url,
      },
    }),
  ]);

  await auditLog({
    userId: req.user!.id,
    findingId: finding.id,
    action: 'UPLOAD_FILE',
    entityType: 'Attachment',
    entityId: attachment.id,
    newValue: JSON.stringify({ fileName: req.file.originalname, size: req.file.size, scan: 'clean' }),
    ipAddress: req.ip,
  });

  res.status(201).json({ evidence, attachment, url: stored.url });
});

export default router;
