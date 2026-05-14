create type public.user_access_status as enum ('pending', 'approved', 'rejected');

create table public.signup_allowlist (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('sawl'),
  email text not null unique,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_access (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default public.morlob_public_id('uacc'),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  status public.user_access_status not null default 'pending',
  is_platform_admin boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_access_set_updated_at
  before update on public.user_access
  for each row execute function public.set_updated_at();

create index user_access_status_created_idx
  on public.user_access(status, created_at desc);

alter table public.signup_allowlist enable row level security;
alter table public.user_access enable row level security;

create policy "users can read their own access"
  on public.user_access for select
  using (user_id = auth.uid());

insert into public.signup_allowlist (email, is_platform_admin)
values ('mail@sserrano.com', true)
on conflict (email) do update
set is_platform_admin = excluded.is_platform_admin;
