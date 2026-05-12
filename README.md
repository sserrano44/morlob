# Morlob

Morlob is a control plane and shared backend for existing external agents. It stores durable workspace state, permissions, files, todos, audit trails, and agent API keys. Morlob does not host or execute agents.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `DATABASE_URL` for the Supabase project. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` still work as fallback keys.
3. Apply migrations with `pnpm db:migrate`.
4. Install dependencies with `pnpm install`.
5. Start the app with `pnpm dev`.

The public API is available at both `/api/v1/...` and `/v1/...`.
