# Morlob

Morlob is a control plane and shared backend for existing external agents. It stores durable workspace state, permissions, files, todos, audit trails, and agent API keys. Morlob does not host or execute agents.

## Current Scope

Implemented P0:

- Supabase Auth for humans.
- Database-backed signup approval.
- Organizations and workspaces.
- Agents, scoped API keys, and workspace assignments.
- Todos with event history and source/external ID upsert.
- Protected files, public-file visibility, signed download URLs, and file-to-todo links.
- OpenClaw workspace skill for Morlob todo REST operations.
- Audit events for sensitive workspace actions.
- Minimal operator UI at `/app`.
- Public REST API under `/api/v1/...` and `/v1/...`.

Not implemented yet:

- MCP endpoint and tools.
- Knowledge base.
- SES mail.
- Billing.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `DATABASE_URL` for the Supabase project. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` still work as fallback keys.
3. Apply migrations with `pnpm db:migrate`.
4. Install dependencies with `pnpm install`.
5. Start the app with `pnpm dev`.

The public API is available at both `/api/v1/...` and `/v1/...`.

## Signup Approval

Signup is open. Emails in the database `signup_allowlist` table are approved automatically; all other users are created with pending access until a platform admin approves them in Morlob.

The bootstrap migration seeds `mail@sserrano.com` as an auto-approved platform admin.

For production, disable direct public signup in Supabase Auth so users cannot bypass Morlob's `/api/auth/signup` approval flow through the Supabase API.

## Scripts

```bash
pnpm dev         # run Next.js locally
pnpm build       # production build
pnpm lint        # ESLint
pnpm test        # Vitest unit tests
pnpm db:migrate  # apply SQL migrations through DATABASE_URL
```

## Docs

- [Deployment](docs/deployment.md)
- [Authentication and Signup Approval](docs/auth.md)
- [REST API](docs/api.md)
- [Skills](docs/skills.md) (`https://www.morlob.com/skills/openclaw-morlob-todos/SKILL.md`)
- [Operations](docs/operations.md)
