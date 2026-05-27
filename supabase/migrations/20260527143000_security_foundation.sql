create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
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

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

alter table if exists public.leads enable row level security;
alter table if exists public.conversations enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.ai_events enable row level security;
alter table if exists public.lead_sequences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
      and policyname = 'organization_members_select_own'
  ) then
    create policy organization_members_select_own
      on public.organization_members
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'organizations'
      and policyname = 'organizations_select_member'
  ) then
    create policy organizations_select_member
      on public.organizations
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.organization_members om
          where om.organization_id = organizations.id
            and om.user_id = auth.uid()
        )
      );
  end if;
end $$;

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

      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = protected_table
          and policyname = protected_table || '_select_org_member'
      ) then
        execute format(
          'create policy %I on public.%I for select to authenticated using (
            organization_id in (
              select organization_id
              from public.organization_members
              where user_id = auth.uid()
            )
          )',
          protected_table || '_select_org_member',
          protected_table
        );
      end if;

      if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = protected_table
          and policyname = protected_table || '_write_org_member'
      ) then
        execute format(
          'create policy %I on public.%I for all to authenticated using (
            organization_id in (
              select organization_id
              from public.organization_members
              where user_id = auth.uid()
            )
          ) with check (
            organization_id in (
              select organization_id
              from public.organization_members
              where user_id = auth.uid()
            )
          )',
          protected_table || '_write_org_member',
          protected_table
        );
      end if;
    end if;
  end loop;
end $$;
