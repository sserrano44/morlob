# Deployment

Morlob is a Next.js application and is currently deployed through Vercel from the GitHub `main` branch.

## Vercel

Import the GitHub repository into Vercel and keep the default Next.js settings:

```text
Install command: pnpm install
Build command: pnpm build
Output directory: default
```

Set these environment variables in Vercel for Production and Preview:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://uwsqokoloqyfckixfmhb.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_API_URL=https://your-domain.example/api

MORLOB_DEPLOYMENT_MODE=self_hosted
MORLOB_APP_DOMAIN=your-domain.example
MORLOB_API_DOMAIN=your-domain.example

API_KEY_PREFIX=mlb
API_RATE_LIMIT_PER_MINUTE=120
MORLOB_STORAGE_BUCKET=morlob-files
MORLOB_MAX_UPLOAD_BYTES=5242880

MCP_SERVER_NAME=morlob
MCP_ENDPOINT=/api/mcp

MORLOB_EMBEDDINGS_PROVIDER=none
```

`DATABASE_URL` is not required by the Vercel runtime. Keep it local for migrations unless you intentionally want migration tooling available in a deployment environment.

## Supabase Auth URLs

In Supabase Auth URL configuration:

```text
Site URL: https://your-domain.example
Redirect URLs:
  https://your-domain.example/**
  http://localhost:3000/**
```

## Migrations

Run database migrations from a trusted local machine:

```bash
pnpm db:migrate
```

The migrator reads `DATABASE_URL` from `.env.local`, applies files in `supabase/migrations`, and records applied versions in `public.morlob_schema_migrations`.

## Post-Deploy Smoke Test

After Vercel deploys:

```text
GET https://your-domain.example/api/v1/health
GET https://your-domain.example/login
GET https://your-domain.example/app
```

Expected:

- `/api/v1/health` returns `{ "ok": true }`.
- `/app` redirects unauthenticated users to `/login`.
- `mail@sserrano.com` can sign up and is auto-approved.
- Other users can sign up but remain pending until approved.
