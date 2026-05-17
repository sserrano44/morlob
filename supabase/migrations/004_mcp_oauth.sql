create table public.oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('oac'),
  code_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  scope text[] not null default array[]::text[],
  resource text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.oauth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('ort'),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id text not null,
  scope text[] not null default array[]::text[],
  resource text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  replaced_by_id uuid references public.oauth_refresh_tokens(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.oauth_access_tokens (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('oat'),
  token_hash text not null unique,
  refresh_token_id uuid references public.oauth_refresh_tokens(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id text not null,
  scope text[] not null default array[]::text[],
  resource text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_authorization_codes_user_idx
  on public.oauth_authorization_codes(user_id, expires_at desc);

create index oauth_access_tokens_lookup_idx
  on public.oauth_access_tokens(token_hash)
  where revoked_at is null;

create index oauth_refresh_tokens_lookup_idx
  on public.oauth_refresh_tokens(token_hash)
  where revoked_at is null;

create index oauth_access_tokens_user_workspace_idx
  on public.oauth_access_tokens(user_id, workspace_id, expires_at desc);

create index oauth_refresh_tokens_user_workspace_idx
  on public.oauth_refresh_tokens(user_id, workspace_id, expires_at desc);

alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_refresh_tokens enable row level security;
alter table public.oauth_access_tokens enable row level security;
