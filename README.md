# Cyber Recovery Hub

Enterprise cyber recovery platform for vulnerability remediation — dashboards, SME work queues, SLA tracking, escalations, and executive reporting.

## Quick start (local)

```bash
npm install
docker compose up -d postgres   # recommended — matches production database
cp .env.example .env
npm run db:setup:postgres
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See [SETUP.md](./SETUP.md) for credentials and role details.

## Production deployment

**Hosted environments require PostgreSQL** — SQLite is for local development only.

| Platform | Use case | Guide |
|----------|----------|-------|
| **Vercel** | Quick frontend demo (API hosted separately) | [DEPLOYMENT.md § Vercel](./DEPLOYMENT.md#vercel-compatibility) |
| **Azure App Service** | Enterprise full-stack hosting | [DEPLOYMENT.md § Azure](./DEPLOYMENT.md#azure-app-service-enterprise--full-stack) |

Key files:

- `vercel.json` — Vercel build configuration
- `Dockerfile` — Azure App Service container deployment
- `.env.example` — all environment variables documented
- `DEPLOYMENT.md` — full production deployment guide

## Stack

- **Frontend:** Next.js 14, Tailwind, Recharts
- **API:** Express, Prisma, session-based auth + RBAC
- **Database:** PostgreSQL (production), SQLite optional (local)
- **Integrations:** Entra ID SSO, SMTP email, Teams webhooks, Redis/BullMQ

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web (development) |
| `npm run build` | Production build |
| `npm run start:production` | Start API + web (production / Azure) |
| `npm run db:setup:postgres` | Docker Postgres + schema + seed |
| `npm run test` | Run test suite |

## Documentation

- [SETUP.md](./SETUP.md) — Development setup, roles, credentials
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel & Azure production hosting
