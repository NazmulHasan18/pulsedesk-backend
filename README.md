# PulseDesk — Backend

Status: **basic project setup + full Prisma schema + Auth module only.**
No conversation/message/faq-doc CRUD, no realtime layer, no RAG yet — see
`HANDOFF.md` in the landing-page repo for the full product roadmap.

---

## 1. Stack

- Node.js + Express + TypeScript
- PostgreSQL + Prisma ORM
- Zod for request validation
- JWT (access + refresh) auth, bcrypt password hashing
- Modular folder structure (`src/modules/<name>/*`), functional service
  pattern (no classes)

---

## 2. Folder structure

```
prisma/
  schema.prisma      All planned models (Company, Agent, SuperAdmin,
                      Conversation, Message, FaqDoc)
  seed.ts             Seeds one SuperAdmin from env vars

src/
  app.ts              Express app: middleware, routes, error handling
  server.ts            Bootstraps Prisma connection + HTTP server, graceful shutdown

  config/
    env.ts             Centralized env var access

  lib/
    prisma.ts          PrismaClient singleton (dev-safe against hot reload)

  middlewares/
    auth.ts             JWT verify + tokenVersion re-check + role guard
    validateRequest.ts   Generic Zod schema validator
    notFound.ts
    globalErrorHandler.ts  Handles ZodError, Prisma known errors, JWT errors, AppError

  utils/
    AppError.ts
    catchAsync.ts
    sendResponse.ts
    jwt.ts               sign/verify helpers
    generateSiteId.ts     Embed script site-id generator

  modules/
    auth/
      auth.route.ts
      auth.controller.ts
      auth.service.ts       All business logic, functional exports
      auth.validation.ts    Zod schemas
      auth.interface.ts     Shared TS types

  routes/
    index.ts            Mounts all module routers under /api/v1 — add new
                         modules here as they're built
```

---

## 3. Data model / multi-tenancy

Everything scopes via `Company` (the landing page's `site-id -> companyId`
model): `Agent`, `Conversation`, and `FaqDoc` all carry a `companyId`.
`SuperAdmin` is platform-level and unscoped.

`FaqDoc.embedding` is a placeholder `Json?` field for now — swap to a real
`Unsupported("vector")` column + raw SQL similarity queries once pgvector
is wired up (see item 4 in the landing page's `HANDOFF.md`).

---

## 4. Auth module — what's implemented

Three identity types, matching the landing page's user types:

| Endpoint | Auth required | Purpose |
|---|---|---|
| `POST /api/v1/auth/register-company` | none | Creates a `Company` + its first `Agent` (role `ADMIN`) in one transaction. This is company sign-up. |
| `POST /api/v1/auth/login` | none | Agent/admin login by email + password. |
| `POST /api/v1/auth/super-admin/login` | none | Super-admin login. Super-admins are **seeded**, not self-registered (see `prisma/seed.ts`). |
| `POST /api/v1/auth/refresh-token` | none (refresh token in body) | Issues a new access token. |
| `POST /api/v1/auth/change-password` | any authenticated user | Bumps `tokenVersion`, invalidating all previously issued tokens. |
| `POST /api/v1/auth/logout` | any authenticated user | Bumps `tokenVersion` (logout-everywhere). |
| `GET /api/v1/auth/me` | any authenticated user | Returns the current agent (+ company) or super-admin profile. |

**Token model:** every JWT carries `{ id (publicId), userType, role?,
companyId?, tokenVersion }`. The `auth()` middleware re-checks
`tokenVersion` against the DB on every request, so `logout` /
`change-password` immediately invalidate old tokens rather than waiting for
expiry. Use `auth('agent')`, `auth('agent', 'ADMIN')`, or
`auth('superadmin')` on any future route to restrict by user type/role.

Not yet built: agent invite flow (an admin adding more agents to their
company), email verification, password reset via email, rate limiting on
login.

---

## 5. Commands

```bash
npm install
cp .env.example .env        # then fill in DATABASE_URL and JWT secrets
npx prisma migrate dev --name init   # creates tables from schema.prisma
npx prisma db seed                    # seeds one super-admin (see below)
npm run dev                           # http://localhost:5000
npm run build && npm start            # production
```

Seed super-admin credentials default to `superadmin@pulsedesk.dev` /
`ChangeMe123!` — override via `SEED_SUPERADMIN_EMAIL` /
`SEED_SUPERADMIN_PASSWORD` env vars before seeding, and change the password
immediately via `/auth/change-password` in any real environment.

---

## 6. Known sandbox gotcha (verification environment only)

**`npx prisma generate` could not run in the build sandbox.** It needs to
download a schema-engine binary from `binaries.prisma.sh`, which wasn't on
the sandbox's network allow-list (npm registry / GitHub only — same
category of restriction as the shadcn CLI and Google Fonts issues noted in
the landing page's `HANDOFF.md`). This is **not a bug in the code**.

Verification performed instead: `npm install` succeeded cleanly, and
`npx tsc --noEmit` was run to type-check everything. The only errors
surfaced were the expected ones caused by the *absence* of the
Prisma-generated types (e.g. `Prisma.PrismaClientKnownRequestError` doesn't
exist until `generate` runs) — nothing else. In any environment with normal
internet access, run:

```bash
npx prisma generate
npx prisma migrate dev --name init
npx tsc --noEmit    # should now be fully clean
```

---

## 7. Next steps (in priority order, mirrors landing-page HANDOFF.md §6)

1. **Agent management module** — admin invites/creates additional agents
   for their company, deactivates agents, etc.
2. **Conversation + Message module** — REST endpoints for listing/claiming
   conversations, posting messages (widget-facing and dashboard-facing).
3. **Widget-facing public endpoints** — anonymous customers have no
   account, so these are unauthenticated but scoped by `site-id` (rate
   limit these carefully).
4. **Realtime layer** — Socket.io server, presence, message routing to a
   claimed agent vs. AI fallback.
5. **FAQ CRUD + RAG** — `FaqDoc` embedding generation + pgvector similarity
   search, wired to Groq for generation.
6. **Super-admin module** — company list, AI-vs-agent usage stats,
   suspend/manage companies.
