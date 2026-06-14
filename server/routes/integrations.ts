import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const INTEGRATIONS = [
  {
    name: 'ServiceNow',
    type: 'ITSM',
    description: 'Bidirectional sync of incidents and change requests',
    endpoints: ['POST /api/integrations/servicenow/incidents', 'GET /api/integrations/servicenow/changes'],
    status: 'designed',
  },
  {
    name: 'CMDB',
    type: 'ASSET',
    description: 'Configuration management database for asset mapping',
    endpoints: ['GET /api/integrations/cmdb/assets', 'GET /api/integrations/cmdb/applications'],
    status: 'designed',
  },
  {
    name: 'Qualys',
    type: 'VULNERABILITY_SCANNER',
    description: 'Automated vulnerability finding ingestion',
    endpoints: ['POST /api/integrations/qualys/webhook', 'GET /api/integrations/qualys/findings'],
    status: 'designed',
  },
  {
    name: 'Tenable',
    type: 'VULNERABILITY_SCANNER',
    description: 'Nessus/Tenable.io scan result integration',
    endpoints: ['POST /api/integrations/tenable/webhook', 'GET /api/integrations/tenable/scans'],
    status: 'designed',
  },
  {
    name: 'Microsoft Defender',
    type: 'EDR',
    description: 'Endpoint detection and response findings',
    endpoints: ['POST /api/integrations/defender/alerts', 'GET /api/integrations/defender/machines'],
    status: 'designed',
  },
  {
    name: 'Microsoft Sentinel',
    type: 'SIEM',
    description: 'Security incident and event correlation',
    endpoints: ['POST /api/integrations/sentinel/incidents', 'GET /api/integrations/sentinel/analytics'],
    status: 'designed',
  },
  {
    name: 'Jira',
    type: 'PROJECT_MANAGEMENT',
    description: 'Remediation task tracking and workflow sync',
    endpoints: ['POST /api/integrations/jira/issues', 'PATCH /api/integrations/jira/issues/:id'],
    status: 'designed',
  },
  {
    name: 'Microsoft Teams',
    type: 'NOTIFICATION',
    description: 'Escalation and reminder notifications via Teams',
    endpoints: ['POST /api/integrations/teams/notify', 'POST /api/integrations/teams/digest'],
    status: 'designed',
  },
  {
    name: 'Power BI',
    type: 'ANALYTICS',
    description: 'Executive reporting and analytics export',
    endpoints: ['GET /api/integrations/powerbi/dataset', 'POST /api/integrations/powerbi/refresh'],
    status: 'designed',
  },
  {
    name: 'Active Directory',
    type: 'IDENTITY',
    description: 'User and group synchronisation for RBAC',
    endpoints: ['GET /api/integrations/ad/users', 'GET /api/integrations/ad/groups'],
    status: 'designed',
  },
  {
    name: 'Entra ID',
    type: 'IDENTITY',
    description: 'Azure AD SSO and conditional access integration',
    endpoints: ['POST /api/integrations/entra/auth', 'GET /api/integrations/entra/users'],
    status: 'designed',
  },
  {
    name: 'SailPoint ISC',
    type: 'IGA',
    description: 'Identity governance and access certification',
    endpoints: ['GET /api/integrations/sailpoint/certifications', 'POST /api/integrations/sailpoint/access-reviews'],
    status: 'designed',
  },
];

router.get('/', authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    architecture: {
      pattern: 'Event-driven integration hub with adapter pattern',
      components: [
        'Integration Gateway (API layer)',
        'Message Queue (async processing)',
        'Adapter Registry (per-integration connectors)',
        'Transformation Engine (normalise external data)',
        'Webhook Receiver (inbound events)',
        'Scheduled Sync Jobs (outbound polling)',
      ],
      dataFlow: 'External System → Webhook/Poll → Adapter → Transform → Finding Service → Notification Engine',
    },
    integrations: INTEGRATIONS,
  });
});

router.get('/:name', authMiddleware, async (req: AuthRequest, res: Response) => {
  const integration = INTEGRATIONS.find(
    (i) => i.name.toLowerCase().replace(/\s/g, '-') === String(req.params.name).toLowerCase()
  );
  if (!integration) return res.status(404).json({ error: 'Integration not found' });
  res.json(integration);
});

export default router;
