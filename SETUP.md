# Cyber Recovery Hub — Development Setup

> **Production hosting:** See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel and Azure App Service deployment.  
> **PostgreSQL is required for hosted environments.** SQLite is local-only.

## Quick Start (PostgreSQL — recommended)

```bash
npm install
docker compose up -d postgres
cp .env.example .env
npm run db:setup:postgres
npm run dev
```

## Quick Start (SQLite — local only)

```bash
npm install
DATABASE_URL="file:./prisma/dev.db" npx prisma db push --schema=prisma/schema.sqlite.prisma
DATABASE_URL="file:./prisma/dev.db" npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you will be redirected to the login screen before accessing the application.

---

## Authentication & Roles

Passwords are stored as bcrypt hashes in the database. **Never use development credentials in production.** In production, configure Entra ID SSO and rotate all secrets.

### Administrator (full control)

The Administrator is the **only** role that can assign vulnerabilities to SMEs, import lists, manage services, and delete findings.

| Username (email) | Name | Role | Dev Password |
|------------------|------|------|--------------|
| `administrator@crh.bank.com` | Administrator | ADMIN | `AdminCrh2025!` |

### SME Accounts (assigned work only)

Each SME can **only** see vulnerabilities assigned to them. They cannot view other SMEs' work or unassigned items.

| Username (email) | Name | Role | Dev Password |
|------------------|------|------|--------------|
| `richard.knight@crh.bank.com` | Richard Knight | SME | `RkCrh2025!` |
| `sammi.powell@crh.bank.com` | Sammi Powell | SME | `SpCrh2025!` |
| `michael.oconnor@crh.bank.com` | Michael O'Connor | SME | `MoCrh2025!` |
| `steven.k@crh.bank.com` | Steven K | SME | `SkCrh2025!` |

### Other demo roles (legacy)

| Email | Role | Password |
|-------|------|----------|
| `analyst@bank.com` | Security Analyst | `demo123` |
| `ciso@bank.com` | CISO | `demo123` |
| `manager@bank.com` | Engineering Manager | `demo123` |

---

## Seeded Data

After `npm run db:seed`:

- **520 vulnerabilities** — 200 unassigned (awaiting Administrator assignment), ~80 per SME
- **11 services**, **67+ users**, **10 teams**

Administrator lands on **Recovery Dashboard** (`/dashboard`) with full sidebar navigation.

---

## Assignment Workflow (Administrator)

1. Sign in as `administrator@crh.bank.com`
2. **Import** vulnerabilities via `/import` (Excel/CSV), or use the seeded unassigned pool
3. Open **Vulnerability Register** → select vulnerabilities → **Bulk Assign** to an SME
4. Assigned items immediately appear in that SME's **My Dashboard** (`/my-actions`)
5. No other SME can access those records (enforced at API level)

---

## Security Model

| Action | Administrator | SME |
|--------|---------------|-----|
| View all vulnerabilities | ✅ | ❌ (assigned only) |
| Import / create / delete | ✅ | ❌ |
| Assign / reassign | ✅ | ❌ |
| Update status, comments, evidence | ✅ | ✅ (own only) |
| View audit trail | ✅ | ❌ |
| Manage users / services | ✅ | ❌ |

All actions are logged in the audit trail with user ID, timestamp, and IP address.

### SME update notifications

When an SME updates a vulnerability, email is sent:

- **TO:** Cyber Recovery Team
- **CC:** Assigned SME, Team Leader, Engineering Manager

---

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Local | Production |
|----------|-------|------------|
| `DATABASE_URL` | `postgresql://crh:...@localhost:5432/...` | Azure PostgreSQL connection string |
| `APP_URL` | `http://localhost:3000` | `https://your-app.azurewebsites.net` |
| `CORS_ORIGINS` | `http://localhost:3000` | Your public app URL |
| `EMAIL_ENABLED` | `false` | `true` with SMTP credentials |
| `ENTRA_*` | Optional | Recommended for SSO |

Full reference: [.env.example](./.env.example) and [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Running Tests

```bash
npm run test
```
