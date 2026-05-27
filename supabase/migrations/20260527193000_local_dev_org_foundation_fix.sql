-- Local/dev organization foundation repair.
--
-- This migration is intentionally additive and idempotent:
-- - creates missing foundation tables if they are absent;
-- - adds missing organization_id columns to existing dev tables;
-- - links existing auth users to a canonical development organization;
-- - backfills existing demo rows without deleting or constraining data.
--
-- Do not add NOT NULL constraints here. Runtime writes still need to be
-- migrated in later phases before stricter database enforcement is safe.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_members_user_id_idx
  on public.organization_members(user_id);

create index if not exists organization_members_organization_id_idx
  on public.organization_members(organization_id);

alter table if exists public.leads
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table if exists public.conversations
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table if exists public.tasks
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table if exists public.ai_events
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

alter table if exists public.lead_sequences
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'leads',
    'conversations',
    'tasks',
    'ai_events',
    'lead_sequences'
  ]
  loop
    if to_regclass(format('public.%I', protected_table)) is not null then
      execute format(
        'create index if not exists %I on public.%I(organization_id)',
        protected_table || '_organization_id_idx',
        protected_table
      );
    end if;
  end loop;
end $$;

do $$
declare
  dev_org_id uuid;
begin
  select id
    into dev_org_id
  from public.organizations
  where slug = 'averon-dev'
  limit 1;

  if dev_org_id is null then
    insert into public.organizations (name, slug)
    values ('AVERON Dev', 'averon-dev')
    returning id into dev_org_id;
  end if;

  insert into public.profiles (id, email)
  select id, email
  from auth.users
  on conflict (id)
  do update set
    email = excluded.email,
    updated_at = now();

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  select
    dev_org_id,
    id,
    'owner'
  from auth.users
  on conflict (organization_id, user_id)
  do update set role = excluded.role;

  if to_regclass('public.leads') is not null then
    update public.leads
    set organization_id = dev_org_id
    where organization_id is null;
  end if;

  if to_regclass('public.conversations') is not null then
    update public.conversations c
    set organization_id = l.organization_id
    from public.leads l
    where c.lead_id = l.id
      and c.organization_id is null
      and l.organization_id is not null;

    update public.conversations
    set organization_id = dev_org_id
    where organization_id is null;
  end if;

  if to_regclass('public.tasks') is not null then
    update public.tasks t
    set organization_id = l.organization_id
    from public.leads l
    where t.lead_id = l.id
      and t.organization_id is null
      and l.organization_id is not null;

    update public.tasks
    set organization_id = dev_org_id
    where organization_id is null;
  end if;

  if to_regclass('public.ai_events') is not null then
    update public.ai_events e
    set organization_id = l.organization_id
    from public.leads l
    where e.lead_id = l.id
      and e.organization_id is null
      and l.organization_id is not null;

    update public.ai_events
    set organization_id = dev_org_id
    where organization_id is null;
  end if;

  if to_regclass('public.lead_sequences') is not null then
    update public.lead_sequences s
    set organization_id = l.organization_id
    from public.leads l
    where s.lead_id = l.id
      and s.organization_id is null
      and l.organization_id is not null;

    update public.lead_sequences
    set organization_id = dev_org_id
    where organization_id is null;
  end if;
end $$;
