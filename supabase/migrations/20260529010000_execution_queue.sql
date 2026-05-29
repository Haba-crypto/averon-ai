-- Phase 18: Execution Queue layer.
--
-- Additive and idempotent:
-- - creates an organization-scoped queue for resumable execution work;
-- - keeps queue creation separate from autonomous execution;
-- - prevents duplicate open queue items for the same work item.

create extension if not exists "pgcrypto";

create table if not exists public.execution_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_item_id uuid not null references public.work_items(id) on delete cascade,
  review_id uuid references public.human_reviews(id) on delete set null,
  source_decision_id uuid references public.agent_decisions(id) on delete set null,
  assigned_agent_id uuid references public.agents(id) on delete set null,
  assigned_agent_name text,
  status text not null default 'pending',
  priority text not null default 'normal',
  queue_reason text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint execution_queue_status_check check (
    status in (
      'pending',
      'ready',
      'in_progress',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  constraint execution_queue_priority_check check (
    priority in ('low', 'normal', 'high', 'urgent')
  )
);

create index if not exists execution_queue_organization_id_idx
  on public.execution_queue(organization_id);

create unique index if not exists execution_queue_id_organization_id_idx
  on public.execution_queue(id, organization_id);

create index if not exists execution_queue_work_item_id_idx
  on public.execution_queue(work_item_id);

create index if not exists execution_queue_review_id_idx
  on public.execution_queue(review_id)
  where review_id is not null;

create unique index if not exists human_reviews_id_organization_id_idx
  on public.human_reviews(id, organization_id);

create index if not exists execution_queue_source_decision_id_idx
  on public.execution_queue(source_decision_id)
  where source_decision_id is not null;

create index if not exists execution_queue_assigned_agent_id_idx
  on public.execution_queue(assigned_agent_id)
  where assigned_agent_id is not null;

create index if not exists execution_queue_organization_status_idx
  on public.execution_queue(organization_id, status);

create index if not exists execution_queue_organization_priority_idx
  on public.execution_queue(organization_id, priority);

create index if not exists execution_queue_organization_created_at_idx
  on public.execution_queue(organization_id, created_at desc);

create unique index if not exists execution_queue_open_work_item_unique_idx
  on public.execution_queue(organization_id, work_item_id)
  where status in ('pending', 'ready', 'in_progress');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_queue_work_item_org_fk'
  ) then
    alter table public.execution_queue
      add constraint execution_queue_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_queue_review_org_fk'
  ) then
    alter table public.execution_queue
      add constraint execution_queue_review_org_fk
      foreign key (review_id, organization_id)
      references public.human_reviews(id, organization_id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_queue_source_decision_org_fk'
  ) then
    alter table public.execution_queue
      add constraint execution_queue_source_decision_org_fk
      foreign key (source_decision_id, organization_id)
      references public.agent_decisions(id, organization_id)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_queue_assigned_agent_org_fk'
  ) then
    alter table public.execution_queue
      add constraint execution_queue_assigned_agent_org_fk
      foreign key (assigned_agent_id, organization_id)
      references public.agents(id, organization_id)
      not valid;
  end if;
end $$;

alter table public.execution_queue enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'execution_queue'
      and policyname = 'execution_queue_select_org_member'
  ) then
    create policy execution_queue_select_org_member
      on public.execution_queue
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
      and tablename = 'execution_queue'
      and policyname = 'execution_queue_write_org_member'
  ) then
    create policy execution_queue_write_org_member
      on public.execution_queue
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
