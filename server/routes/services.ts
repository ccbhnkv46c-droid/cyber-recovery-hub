import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, auditLog, requireRoles, AuthRequest } from '../middleware/auth';
import { DEFAULT_SERVICES } from '../../lib/services';

const router = Router();

router.get('/', authMiddleware, async (_req, res: Response) => {
  const services = await prisma.service.findMany({
    include: { _count: { select: { findings: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(services);
});

router.get('/:id', authMiddleware, async (req, res: Response) => {
  const service = await prisma.service.findUnique({
    where: { id: String(req.params.id) },
    include: {
      _count: { select: { findings: true } },
      findings: {
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: { findingId: true, title: true, severity: true, status: true },
      },
    },
  });
  if (!service) return res.status(404).json({ error: 'Service not found' });
  res.json(service);
});

router.post('/', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { name, description, owner, criticality, businessArea } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Service name is required' });

  const existing = await prisma.service.findUnique({ where: { name: name.trim() } });
  if (existing) return res.status(409).json({ error: 'Service already exists' });

  const service = await prisma.service.create({
    data: {
      name: name.trim(),
      description: description || '',
      owner: owner || null,
      criticality: criticality || 'MEDIUM',
      businessArea: businessArea || 'General',
    },
  });

  await auditLog({
    userId: req.user!.id,
    action: 'CREATE_SERVICE',
    entityType: 'Service',
    entityId: service.id,
    newValue: service.name,
    ipAddress: req.ip,
  });

  res.status(201).json(service);
});

router.patch('/:id', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const service = await prisma.service.update({
    where: { id: String(req.params.id) },
    data: {
      name: req.body.name?.trim(),
      description: req.body.description,
      owner: req.body.owner,
      criticality: req.body.criticality,
      businessArea: req.body.businessArea,
      isActive: req.body.isActive,
    },
  });
  res.json(service);
});

router.post('/seed-defaults', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const created = [];
  for (const s of DEFAULT_SERVICES) {
    const existing = await prisma.service.findUnique({ where: { name: s.name } });
    if (!existing) {
      const svc = await prisma.service.create({ data: s });
      created.push(svc);
    }
  }
  res.json({ created: created.length, services: created });
});

export default router;
