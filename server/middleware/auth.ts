import { Request, Response, NextFunction } from 'express';
import prisma from '../../lib/prisma';
import { UserRole } from '../../lib/constants';
import { Permission, hasPermission } from '../../lib/rbac';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    teamId?: string | null;
    department?: string | null;
  };
  sessionToken?: string;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.session;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as UserRole,
    teamId: session.user.teamId,
    department: session.user.department,
  };
  req.sessionToken = token;
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role) && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const allowed = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

export async function auditLog(params: {
  userId?: string;
  findingId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}) {
  await prisma.auditLog.create({ data: params });
}

export async function cleanupExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
