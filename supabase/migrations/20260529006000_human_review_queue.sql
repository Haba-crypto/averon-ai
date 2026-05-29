-- Phase 13: Human Review Queue.
--
-- Additive and idempotent:
-- - extends the existing human_reviews table into a first-class queue;
-- - keeps legacy request_payload/response_payload/requested_by/reviewer_user_id fields;
-- - supports review lifecycle statuses required by Phase 13;
-- - prevents duplicate open reviews for the same work item and review type.

create extension if not exists "pgcrypto";

create table if not exists public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  agent_execution_id uuid references public.agent_executions(id) on delete set null,
  agent_decision_id uuid references public.agent_decisions(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  source_agent_id uuid references public.agents(id) on delete set null,
  source_agent_name text,
  status text not null default 'pending',
  review_type text not null default 'approval',
  review_reason text,
  priority text not null default 'normal',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  decision text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_outcome text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.human_reviews
  add column if not exists source_agent_id uuid references public.agents(id) on delete set null,
  add column if not exists source_agent_name text,
  add column if not exists review_reason text,
  add column if not exists priority text not null default 'normal',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists review_outcome text,
  add column if not exists review_notes text;

create index if not exists human_reviews_source_agent_id_idx
  on public.human_reviews(source_agent_id)
  where source_agent_id is not null;

create index if not exists human_reviews_reviewed_by_idx
  on public.human_reviews(reviewed_by)
  where reviewed_by is not null;

create index if not exists human_reviews_organization_priority_idx
  on public.human_reviews(organization_id, priority);

create index if not exists human_reviews_organization_requested_at_idx
  on public.human_reviews(organization_id, requested_at desc);

create unique index if not exists human_reviews_open_work_item_type_unique_idx
  on public.human_reviews(organization_id, work_item_id, review_type)
  where status in ('pending', 'in_review')
    and work_item_id is not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'human_reviews_status_check'
  ) then
    alter table public.human_reviews
      drop constraint human_reviews_status_check;
  end if;

  alter table public.human_reviews
    add constraint human_reviews_status_check
    check (
      status in (
        'pending',
        'in_review',
        'approved',
        'rejected',
        'completed'
      )
    )
    not valid;

  if exists (
    select 1
    from pg_constraint
    where conname = 'human_reviews_decision_check'
  ) then
    alter table public.human_reviews
      drop constraint human_reviews_decision_check;
  end if;

  alter table public.human_reviews
    add constraint human_reviews_decision_check
    check (
      decision is null or decision in (
        'approve',
        'reject',
        'complete'
      )
    )
    not valid;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'human_reviews_priority_check'
  ) then
    alter table public.human_reviews
      add constraint human_reviews_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'human_reviews_source_agent_org_fk'
  ) then
    alter table public.human_reviews
      add constraint human_reviews_source_agent_org_fk
      foreign key (source_agent_id, organization_id)
      references public.agents(id, organization_id)
      not valid;
  end if;
end $$;

alter table public.human_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'human_reviews'
      and policyname = 'human_reviews_select_org_member'
  ) then
    create policy human_reviews_select_org_member
      on public.human_reviews
      for select
      to authenticated
      using (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'human_reviews'
      and policyname = 'human_reviews_write_org_member'
  ) then
    create policy human_reviews_write_org_member
      on public.human_reviews
      for all
      to authenticated
      using (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
        )
      )
      with check (
        organization_id in (
          select organization_id
          from public.organization_members
          where user_id = auth.uid()
        )
      );
  end if;
end $$;
