create extension if not exists pgcrypto;

create or replace function public.morlob_public_id(prefix text)
returns text
language sql
volatile
as $$
  select prefix || '_' || encode(gen_random_bytes(10), 'hex');
$$;

create type public.organization_status as enum ('active', 'disabled', 'archived');
create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.workspace_status as enum ('active', 'disabled', 'archived');
create type public.agent_status as enum ('active', 'disabled', 'archived');
create type public.todo_status as enum ('open', 'in_progress', 'blocked', 'waiting_for_review', 'completed', 'cancelled', 'archived');
create type public.todo_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.actor_type as enum ('human', 'agent', 'org_key', 'system');
create type public.assignee_type as enum ('human', 'agent');
create type public.todo_source as enum ('manual', 'api', 'mcp', 'claude_cowork', 'openclaw', 'codex', 'other');
create type public.file_kind as enum ('artifact', 'attachment', 'knowledge_source', 'skill_asset', 'log', 'export', 'other');
create type public.file_visibility as enum ('private', 'public');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('org'),
  name text not null,
  slug text not null unique,
  status public.organization_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('omem'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('wsp'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status public.workspace_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, slug)
);

create table public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('wmem'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('agt'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  kind text not null default 'generic',
  status public.agent_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.agent_api_keys (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('akey'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  name text not null,
  key_prefix text not null unique,
  key_hash text not null,
  hash_salt text not null,
  scopes text[] not null default array[]::text[],
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agent_workspace_assignments (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('awasn'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (agent_id, workspace_id)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('aud'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_type public.actor_type not null,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  ip_address inet,
  user_agent text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('todo'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  status public.todo_status not null default 'open',
  priority public.todo_priority not null default 'medium',
  assignee_type public.assignee_type,
  assignee_id uuid,
  source public.todo_source not null default 'manual',
  external_id text,
  labels text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  scheduled_for timestamptz,
  created_by_type public.actor_type not null,
  created_by_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index todos_workspace_source_external_id_idx
  on public.todos (workspace_id, source, external_id)
  where external_id is not null and deleted_at is null;

create table public.todo_events (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('tevt'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  todo_id uuid not null references public.todos(id) on delete cascade,
  actor_type public.actor_type not null,
  actor_id uuid,
  event_type text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('file'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_type public.actor_type not null,
  uploader_id uuid,
  kind public.file_kind not null default 'artifact',
  filename text not null,
  content_type text not null default 'application/octet-stream',
  size_bytes bigint not null check (size_bytes >= 0),
  checksum_sha256 text not null,
  storage_bucket text not null,
  storage_path text not null,
  visibility public.file_visibility not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.resource_links (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('link'),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_resource_type text not null,
  source_resource_id uuid not null,
  target_resource_type text not null,
  target_resource_id uuid not null,
  relationship text not null,
  created_by_type public.actor_type not null,
  created_by_id uuid,
  created_at timestamptz not null default now()
);

create index organization_memberships_user_id_idx on public.organization_memberships(user_id);
create index workspace_memberships_user_id_idx on public.workspace_memberships(user_id);
create index workspaces_organization_id_idx on public.workspaces(organization_id);
create index agents_organization_id_idx on public.agents(organization_id);
create index agent_workspace_assignments_agent_idx on public.agent_workspace_assignments(agent_id, revoked_at);
create index todos_workspace_status_idx on public.todos(workspace_id, status) where deleted_at is null;
create index files_workspace_visibility_idx on public.files(workspace_id, visibility) where deleted_at is null;
create index audit_events_org_workspace_created_idx on public.audit_events(organization_id, workspace_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger organization_memberships_set_updated_at
  before update on public.organization_memberships
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger workspace_memberships_set_updated_at
  before update on public.workspace_memberships
  for each row execute function public.set_updated_at();

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_member(wsp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_memberships
    where workspace_id = wsp_id
      and user_id = auth.uid()
  );
$$;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.agents enable row level security;
alter table public.agent_api_keys enable row level security;
alter table public.agent_workspace_assignments enable row level security;
alter table public.audit_events enable row level security;
alter table public.todos enable row level security;
alter table public.todo_events enable row level security;
alter table public.files enable row level security;
alter table public.resource_links enable row level security;

create policy "members can read organizations"
  on public.organizations for select
  using (public.is_org_member(id));

create policy "members can read organization memberships"
  on public.organization_memberships for select
  using (public.is_org_member(organization_id));

create policy "members can read workspaces"
  on public.workspaces for select
  using (public.is_org_member(organization_id));

create policy "admins can write workspaces"
  on public.workspaces for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "members can read workspace memberships"
  on public.workspace_memberships for select
  using (public.is_org_member(organization_id));

create policy "admins can write workspace memberships"
  on public.workspace_memberships for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "members can read agents"
  on public.agents for select
  using (public.is_org_member(organization_id));

create policy "admins can write agents"
  on public.agents for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "admins can read agent keys"
  on public.agent_api_keys for select
  using (public.is_org_admin(organization_id));

create policy "admins can manage agent keys"
  on public.agent_api_keys for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "members can read agent workspace assignments"
  on public.agent_workspace_assignments for select
  using (public.is_org_member(organization_id));

create policy "admins can manage agent workspace assignments"
  on public.agent_workspace_assignments for all
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "members can read audit events"
  on public.audit_events for select
  using (public.is_org_member(organization_id));

create policy "workspace members can read todos"
  on public.todos for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can write todos"
  on public.todos for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can read todo events"
  on public.todo_events for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can read files"
  on public.files for select
  using (visibility = 'public' or public.is_workspace_member(workspace_id));

create policy "workspace members can write files"
  on public.files for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "workspace members can read links"
  on public.resource_links for select
  using (public.is_workspace_member(workspace_id));

create policy "workspace members can write links"
  on public.resource_links for all
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('morlob-files', 'morlob-files', false, 5242880)
on conflict (id) do nothing;
