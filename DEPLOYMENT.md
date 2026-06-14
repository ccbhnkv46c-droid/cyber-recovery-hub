# Cyber Recovery Hub — Production Deployment

This guide covers hosting the Cyber Recovery Hub for demos (Vercel) and enterprise production (Azure App Service).

## Architecture overview

The application has two runtime components:

| Component | Technology | Port | Role |
|-----------|------------|------|------|
| **Web** | Next.js 14 | `PORT` (3000 / 8080) | UI, proxies `/api/*` to Express |
| **API** | Express + Prisma | `API_PORT` (3001) | Auth, RBAC, findings, dashboards, email |

```
Browser → Next.js (/api/* rewrite) → Express API → PostgreSQL
```

**Authentication** uses database-backed sessions (Bearer token). **RBAC** is enforced in Express middleware — it works identically in hosted mode as long as `DATABASE_URL` points to a shared PostgreSQL instance.

---

## Vercel compatibility

### What works on Vercel

| Feature | Supported |
|---------|-----------|
| Next.js frontend (all pages) | ✅ |
| API proxy via rewrites | ✅ (to external API) |
| Static marketing homepage | ✅ |
| Live KPI polling | ✅ (via proxied API) |

### What does **not** work on Vercel alone

| Feature | Reason |
|---------|--------|
| Express API server | Vercel is serverless — no long-running Node processes |
| SQLite database | Ephemeral filesystem; not shared across instances |
| Background jobs (BullMQ) | Requires Redis + persistent worker |
| Local file uploads | Ephemeral disk |

### Recommended Vercel demo architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│  Vercel (Next.js)   │  HTTPS  │  Azure App Service (API) │
│  your-app.vercel.app│ ──────► │  crh-api.azurewebsites.net│
└─────────────────────┘         └───────────┬──────────────┘
                                            │
                                ┌───────────▼──────────────┐
                                │  Azure Database for       │
                                │  PostgreSQL               │
                                └──────────────────────────┘
```

Deploy the **API + database** to Azure (or any Node host), then deploy the **frontend** to Vercel with `API_URL` pointing at the hosted API.

### Deploy frontend to Vercel

1. Push the repository to GitHub.
2. Import the project in [Vercel](https://vercel.com).
3. Set environment variables:

| Variable | Example | Required |
|----------|---------|----------|
| `API_URL` | `https://crh-api.azurewebsites.net` | ✅ |
| `APP_URL` | `https://your-app.vercel.app` | ✅ |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` | ✅ |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Set on **API** host |

4. Build settings (auto-detected from `vercel.json`):
   - **Framework:** Next.js
   - **Build command:** `next build`
   - **Install command:** `npm install`

5. Deploy. The `vercel.json` and `next.config.js` rewrite `/api/*` to your hosted API.

> **Note:** `DATABASE_URL` is **not** required on Vercel when using a split deployment — only the API server needs it.

### Entra SSO with Vercel frontend

Register the redirect URI as your **public** URL (the domain users see):

```
https://your-app.vercel.app/api/auth/entra/callback
```

Vercel rewrites this to the Express API. Set the same value in `ENTRA_REDIRECT_URI` on the API host.

---

## Azure App Service (enterprise — full stack)

Azure App Service runs both Next.js and Express in a single container or Node process. This is the recommended **enterprise** deployment.

### Prerequisites

- Azure subscription
- [Azure Database for PostgreSQL](https://learn.microsoft.com/en-us/azure/postgresql/) (Flexible Server recommended)
- Optional: Azure Cache for Redis, Azure Blob Storage, SendGrid / Office 365 SMTP

### Option A — Docker container (recommended)

1. **Create PostgreSQL**

```bash
# Example connection string format
DATABASE_URL=postgresql://crhadmin:<password>@crh-db.postgres.database.azure.com:5432/cyber_recovery_hub?sslmode=require
```

2. **Build and push the Docker image**

```bash
az acr create --resource-group crh-rg --name crhregistry --sku Basic
az acr login --name crhregistry
docker build -t crhregistry.azurecr.io/cyber-recovery-hub:latest .
docker push crhregistry.azurecr.io/cyber-recovery-hub:latest
```

3. **Create App Service (Linux, container)**

```bash
az appservice plan create --resource-group crh-rg --name crh-plan --is-linux --sku B2
az webapp create --resource-group crh-rg --plan crh-plan --name crh-app \
  --deployment-container-image-name crhregistry.azurecr.io/cyber-recovery-hub:latest
```

4. **Configure App Service environment variables**

In Azure Portal → App Service → **Configuration** → **Application settings**:

| Setting | Value |
|---------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | PostgreSQL connection string (with `?sslmode=require`) |
| `APP_URL` | `https://crh-app.azurewebsites.net` |
| `CORS_ORIGINS` | `https://crh-app.azurewebsites.net` |
| `PORT` | `8080` (Azure default — already injected) |
| `API_PORT` | `3001` |
| `TRUST_PROXY` | `true` |
| `RUN_DB_PUSH` | `true` (first deploy only, then remove) |
| `EMAIL_ENABLED` | `true` |
| `SMTP_HOST` | Your SMTP server |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `EMAIL_FROM` | `cyber-recovery@yourbank.com` |
| `CYBER_RECOVERY_TEAM_EMAIL` | `cyber-recovery@yourbank.com` |
| `ENTRA_TENANT_ID` | Azure AD tenant |
| `ENTRA_CLIENT_ID` | App registration client ID |
| `ENTRA_CLIENT_SECRET` | Client secret |
| `ENTRA_REDIRECT_URI` | `https://crh-app.azurewebsites.net/api/auth/entra/callback` |
| `STORAGE_PROVIDER` | `azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage connection string |
| `AZURE_STORAGE_CONTAINER` | `crh-evidence` |
| `REDIS_URL` | `rediss://...` (Azure Cache for Redis, optional) |

5. **Health check**

Set **Health check path** to `/api/health` in App Service → **Health check**.

6. **Seed the database** (one-time)

```bash
# From a machine with network access to PostgreSQL
DATABASE_URL="postgresql://..." npm run db:seed
```

### Option B — Node.js runtime (no Docker)

1. Deploy via GitHub Actions or `az webapp up`.
2. Set **Startup command** to:

```
npm run start:production
```

3. Set the same environment variables as Option A.

---

## Database: PostgreSQL (required for hosting)

SQLite (`file:./prisma/dev.db`) is suitable for local development only. **Hosted deployments must use PostgreSQL.**

### Why PostgreSQL?

| Concern | SQLite | PostgreSQL |
|---------|--------|------------|
| Vercel / Azure multi-instance | ❌ Ephemeral | ✅ Managed service |
| Concurrent SME updates | ❌ Single writer | ✅ Full ACID |
| Backup & audit retention | ❌ File copy | ✅ Azure automated backups |
| Connection pooling | ❌ | ✅ PgBouncer / Prisma |

### Local PostgreSQL (Docker)

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://crh:crh_dev_password@localhost:5432/cyber_recovery_hub npm run db:setup
```

### Schema migration

```bash
# Apply schema to PostgreSQL
npx prisma db push

# Seed demo data (development / demo only)
npm run db:seed
```

### Local SQLite (optional, offline dev)

```bash
DATABASE_URL="file:./prisma/dev.db" npx prisma db push --schema=prisma/schema.sqlite.prisma
DATABASE_URL="file:./prisma/dev.db" npm run db:seed
```

---

## Authentication & RBAC in production

### Local password auth

Works in hosted mode for demos, but **disable demo accounts in production**:

1. Run `db:seed` only in non-production environments.
2. Change or deactivate seeded passwords.
3. Prefer Entra ID SSO.

### Microsoft Entra ID SSO

1. Azure Portal → **App registrations** → New registration.
2. Add redirect URI: `https://<your-domain>/api/auth/entra/callback`
3. Create a client secret.
4. Assign users to Entra security groups mapped to CRH roles:
   - `CRH-Admins`, `CRH-Security-Analysts`, `CRH-Engineers`, etc.
5. Set environment variables on the **API host** (see table above).

RBAC is enforced server-side via `lib/rbac.ts` — no frontend changes are needed for hosted mode.

### Session security

- Sessions are stored in PostgreSQL (`Session` table).
- Tokens expire after 8 hours.
- Set `TRUST_PROXY=true` behind Azure / Vercel rewrites for accurate IP logging.

---

## Email notifications in production

SME vulnerability updates send email via SMTP when configured:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=cyber-recovery@yourbank.com
SMTP_PASS=<app-password>
EMAIL_FROM=cyber-recovery@yourbank.com
CYBER_RECOVERY_TEAM_EMAIL=cyber-recovery@yourbank.com
```

**Azure options:**
- Office 365 SMTP (recommended for enterprise)
- SendGrid (`smtp.sendgrid.net`, port 587)
- Azure Communication Services Email

Without `EMAIL_ENABLED=true`, notifications are logged to console only (visible in App Service log stream).

Verify with `/admin/email-outbox` (Administrator role) after an SME updates a finding.

---

## Environment variable reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Production | PostgreSQL connection string |
| `APP_URL` | ✅ Production | Public app URL (no trailing slash) |
| `CORS_ORIGINS` | ✅ Production | Comma-separated allowed origins |
| `API_URL` | Vercel only | External API URL for Next.js rewrites |
| `API_PORT` | Azure | Express port (default `3001`) |
| `PORT` | Azure | Next.js port (Azure sets `8080`) |
| `ENTRA_*` | Recommended | Microsoft Entra ID SSO |
| `EMAIL_ENABLED` | Recommended | Enable SMTP notifications |
| `SMTP_*` | If email enabled | SMTP server credentials |
| `CYBER_RECOVERY_TEAM_EMAIL` | Recommended | TO address for SME updates |
| `REDIS_URL` | Optional | BullMQ background jobs |
| `STORAGE_PROVIDER` | Production | `azure` or `s3` for evidence files |
| `AZURE_STORAGE_*` | If azure storage | Blob storage connection |
| `TRUST_PROXY` | ✅ Behind proxy | `true` for Azure / load balancers |
| `RUN_DB_PUSH` | First deploy | `true` to auto-apply schema in Docker |

Copy `.env.example` for the full list.

---

## Post-deployment checklist

- [ ] `GET /api/health` returns `status: healthy` and `database: connected`
- [ ] Login works (local or Entra SSO)
- [ ] Administrator can access `/admin` and `/register`
- [ ] SME sees only assigned findings on `/my-actions`
- [ ] Completing a task removes it from open dashboards
- [ ] Email appears in `/admin/email-outbox` after SME update (if SMTP configured)
- [ ] `CORS_ORIGINS` matches your public URL (no CORS errors in browser console)
- [ ] Demo passwords rotated or Entra SSO enforced
- [ ] PostgreSQL backups enabled in Azure

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| API 404 on Vercel | Set `API_URL` to hosted API; redeploy Vercel |
| CORS error | Add Vercel URL to `CORS_ORIGINS` on API host |
| `database: disconnected` | Check `DATABASE_URL`, firewall rules, `sslmode=require` |
| Entra redirect mismatch | `ENTRA_REDIRECT_URI` must exactly match Azure app registration |
| Emails not sending | Set `EMAIL_ENABLED=true`, verify SMTP credentials |
| Uploads lost on restart | Use `STORAGE_PROVIDER=azure` with Blob Storage |
| Login 429 | Rate limit — wait 15 min or adjust proxy trust settings |

---

## Quick reference commands

```bash
# Local PostgreSQL setup
docker compose up -d postgres
cp .env.example .env
npm run db:setup:postgres
npm run dev

# Production Docker build
docker build -t cyber-recovery-hub .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." -e RUN_DB_PUSH=true cyber-recovery-hub

# Health check
curl https://your-app.azurewebsites.net/api/health
```

For development credentials and role details, see [SETUP.md](./SETUP.md).
