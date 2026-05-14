# Operations

## Local Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm db:migrate
```

## Database Migrations

Migration files live in:

```text
supabase/migrations
```

The migrator:

- reads `DATABASE_URL` from `.env.local`
- applies migrations in sorted order
- records applied migrations in `public.morlob_schema_migrations`
- keeps `SUPABASE_DB_URL` as a legacy fallback

Run:

```bash
pnpm db:migrate
```

## Current Migrations

```text
001_core_todos_files.sql
002_resource_links_unique.sql
003_signup_access.sql
```

## Required Supabase Resources

The first migration creates:

- core tables
- RLS policies
- `morlob-files` storage bucket

The signup migration creates:

- `signup_allowlist`
- `user_access`

## First Admin

`003_signup_access.sql` seeds:

```text
mail@sserrano.com
```

as an allowlisted platform admin.

## Deployment Notes

Vercel deploys from GitHub `main`.

Schema changes are not run during Vercel builds. Apply migrations separately with `pnpm db:migrate`.

After pushing app changes, check:

```text
/api/v1/health
/login
/app
```

## Security Notes

- Keep `SUPABASE_SECRET_KEY` server-only.
- Keep `DATABASE_URL` out of Vercel unless intentionally needed.
- Disable direct public signup in Supabase Auth for production.
- Do not expose plaintext agent API keys after creation.
- Files are private unless `visibility` is explicitly set to `public`.
