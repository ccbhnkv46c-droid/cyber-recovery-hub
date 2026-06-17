import { Router, Response } from 'express';
import prisma from '../../lib/prisma';
import { authMiddleware, auditLog, requireRoles, AuthRequest } from '../middleware/auth';
import { isAssignedOnlyRole } from '../../lib/rbac';
import { ACTIVE_STATUSES } from '../../lib/constants';
import { deriveExposureLevel } from '../../lib/assets';
import { Prisma } from '@prisma/client';

const router = Router();

const assetInclude = {
  service: { select: { id: true, name: true, businessArea: true, criticality: true } },
  application: { select: { id: true, name: true, businessService: true } },
  businessOwner: { select: { id: true, name: true, email: true } },
  technicalOwner: { select: { id: true, name: true, email: true } },
  sme: { select: { id: true, name: true, email: true } },
  _count: { select: { findings: true } },
};

function buildAssetWhere(req: AuthRequest): Prisma.AssetWhereInput {
  const user = req.user!;
  if (user.role === 'ADMIN' || user.role === 'CISO' || user.role === 'SECURITY_ANALYST') {
    return {};
  }
  if (isAssignedOnlyRole(user.role)) {
    return {
      findings: {
        some: { ownerId: user.id },
      },
    };
  }
  if (user.role === 'TEAM_LEADER' && user.teamId) {
    return {
      findings: {
        some: { teamId: user.teamId },
      },
    };
  }
  if (user.role === 'ENGINEERING_MANAGER' && user.department) {
    return {
      findings: {
        some: { businessArea: user.department },
      },
    };
  }
  return {};
}

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const filters = req.query as Record<string, string>;
  const where: Prisma.AssetWhereInput = { ...buildAssetWhere(req), isActive: true };

  if (filters.serviceId) where.serviceId = filters.serviceId;
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.environment) where.environment = filters.environment;
  if (filters.businessCriticality) where.businessCriticality = filters.businessCriticality;
  if (filters.internetFacing === 'true') where.internetFacing = true;
  if (filters.criticalService === 'true') where.criticalService = true;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search } },
      { hostingLocation: { contains: filters.search } },
      { owner: { contains: filters.search } },
    ];
  }

  const assets = await prisma.asset.findMany({
    where,
    include: {
      ...assetInclude,
      findings: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { id: true, severity: true, targetDate: true, status: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const enriched = assets.map((asset) => {
    const openFindings = asset.findings;
    const overdue = openFindings.filter((f) => new Date(f.targetDate) < new Date()).length;
    const critical = openFindings.filter((f) => f.severity === 'CRITICAL').length;
    const { findings, ...rest } = asset;
    return {
      ...rest,
      openFindings: openFindings.length,
      overdueFindings: overdue,
      criticalFindings: critical,
    };
  });

  enriched.sort((a, b) => b.openFindings - a.openFindings);
  res.json(enriched);
});

router.get('/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  const baseWhere = buildAssetWhere(req);
  const assets = await prisma.asset.findMany({
    where: { ...baseWhere, isActive: true },
    include: {
      service: { select: { name: true } },
      findings: {
        where: { status: { in: ACTIVE_STATUSES } },
        select: { severity: true, targetDate: true, status: true },
      },
    },
  });

  const criticalAssets = assets.filter(
    (a) => a.businessCriticality === 'CRITICAL' && a.findings.length > 0
  ).length;

  const internetFacing = assets.filter(
    (a) => a.internetFacing && a.findings.length > 0
  ).length;

  const overdueAssets = assets.filter((a) =>
    a.findings.some((f) => new Date(f.targetDate) < new Date())
  ).length;

  const serviceExposure: Record<string, { name: string; open: number; critical: number; internetFacing: number }> = {};
  for (const asset of assets) {
    if (asset.findings.length === 0) continue;
    const svcName = asset.service.name;
    if (!serviceExposure[svcName]) {
      serviceExposure[svcName] = { name: svcName, open: 0, critical: 0, internetFacing: 0 };
    }
    serviceExposure[svcName].open += asset.findings.length;
    serviceExposure[svcName].critical += asset.findings.filter((f) => f.severity === 'CRITICAL').length;
    if (asset.internetFacing) serviceExposure[svcName].internetFacing += asset.findings.length;
  }

  const topServices = Object.values(serviceExposure)
    .sort((a, b) => b.open - a.open)
    .slice(0, 5);

  const topAssets = assets
    .filter((a) => a.findings.length > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      service: a.service.name,
      openFindings: a.findings.length,
      businessCriticality: a.businessCriticality,
      internetFacing: a.internetFacing,
    }))
    .sort((a, b) => b.openFindings - a.openFindings)
    .slice(0, 10);

  res.json({
    criticalAssetsWithOpenVulns: criticalAssets,
    internetFacingAssetsWithOpenVulns: internetFacing,
    assetsWithOverdueRemediation: overdueAssets,
    topServicesByExposure: topServices,
    topAssetsByOpenFindings: topAssets,
  });
});

router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  const asset = await prisma.asset.findUnique({
    where: { id: String(req.params.id) },
    include: {
      ...assetInclude,
      findings: {
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          findingId: true,
          title: true,
          severity: true,
          status: true,
          targetDate: true,
          owner: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  if (isAssignedOnlyRole(req.user!.role)) {
    const hasAccess = await prisma.finding.count({
      where: { assetId: asset.id, ownerId: req.user!.id },
    });
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });
  }

  res.json(asset);
});

router.post('/', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  if (!data.name?.trim()) return res.status(400).json({ error: 'Asset name is required' });
  if (!data.serviceId) return res.status(400).json({ error: 'serviceId is required' });

  const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
  if (!service) return res.status(400).json({ error: 'Invalid serviceId' });

  const internetFacing = Boolean(data.internetFacing);
  const environment = data.environment || 'PRODUCTION';

  const asset = await prisma.asset.create({
    data: {
      name: data.name.trim(),
      assetType: data.assetType || 'Server',
      hostingLocation: data.hostingLocation || null,
      environment,
      internetFacing,
      criticalService: Boolean(data.criticalService),
      dataClassification: data.dataClassification || null,
      businessCriticality: data.businessCriticality || 'MEDIUM',
      owner: data.owner || null,
      businessOwnerId: data.businessOwnerId || null,
      technicalOwnerId: data.technicalOwnerId || null,
      smeId: data.smeId || null,
      serviceId: data.serviceId,
      applicationId: data.applicationId || null,
    },
    include: assetInclude,
  });

  await auditLog({
    userId: req.user!.id,
    action: 'CREATE_ASSET',
    entityType: 'Asset',
    entityId: asset.id,
    newValue: asset.name,
    ipAddress: req.ip,
  });

  res.status(201).json(asset);
});

router.patch('/:id', authMiddleware, requireRoles('ADMIN'), async (req: AuthRequest, res: Response) => {
  const data = req.body;
  const updateData: Prisma.AssetUpdateInput = {};

  const fields = [
    'name', 'assetType', 'hostingLocation', 'environment', 'internetFacing',
    'criticalService', 'dataClassification', 'businessCriticality', 'owner', 'isActive',
  ] as const;

  for (const field of fields) {
    if (data[field] !== undefined) {
      (updateData as Record<string, unknown>)[field] = data[field];
    }
  }

  if (data.businessOwnerId !== undefined) {
    updateData.businessOwner = data.businessOwnerId
      ? { connect: { id: data.businessOwnerId } }
      : { disconnect: true };
  }
  if (data.technicalOwnerId !== undefined) {
    updateData.technicalOwner = data.technicalOwnerId
      ? { connect: { id: data.technicalOwnerId } }
      : { disconnect: true };
  }
  if (data.smeId !== undefined) {
    updateData.sme = data.smeId ? { connect: { id: data.smeId } } : { disconnect: true };
  }
  if (data.serviceId) updateData.service = { connect: { id: data.serviceId } };
  if (data.applicationId !== undefined) {
    updateData.application = data.applicationId
      ? { connect: { id: data.applicationId } }
      : { disconnect: true };
  }

  const asset = await prisma.asset.update({
    where: { id: String(req.params.id) },
    data: updateData,
    include: assetInclude,
  });

  await auditLog({
    userId: req.user!.id,
    action: 'UPDATE_ASSET',
    entityType: 'Asset',
    entityId: asset.id,
    newValue: asset.name,
    ipAddress: req.ip,
  });

  res.json(asset);
});

export default router;

export async function resolveAssetForFinding(
  assetId: string | undefined,
  assetName: string | undefined,
  serviceId: string,
  applicationId?: string | null,
): Promise<{ assetId: string | null; assetName: string | null; exposureLevel: string | null }> {
  if (assetId) {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Invalid assetId');
    return {
      assetId: asset.id,
      assetName: asset.name,
      exposureLevel: deriveExposureLevel(asset.internetFacing, asset.environment),
    };
  }

  if (assetName?.trim()) {
    const existing = await prisma.asset.findFirst({
      where: { name: assetName.trim(), serviceId },
    });
    if (existing) {
      return {
        assetId: existing.id,
        assetName: existing.name,
        exposureLevel: deriveExposureLevel(existing.internetFacing, existing.environment),
      };
    }
  }

  return { assetId: null, assetName: assetName?.trim() || null, exposureLevel: null };
}
