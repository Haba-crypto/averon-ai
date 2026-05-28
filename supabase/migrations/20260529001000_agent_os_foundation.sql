-- Agent OS foundation schema.
--
-- Phase 1 only:
-- - creates organization-scoped agent/workflow/memory tables;
-- - enables RLS with membership-based access;
-- - adds relational integrity and operational indexes;
-- - does not backfill data or alter existing application workflows.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  status text not null default 'active',
  version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agents_status_check check (status in ('active', 'inactive', 'archived')),
  constraint agents_version_check check (version > 0),
  constraint agents_organization_key_unique unique (organization_id, key)
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  type text not null default 'internal',
  config_schema jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tools_type_check check (type in ('internal', 'function', 'api', 'webhook')),
  constraint tools_organization_key_unique unique (organization_id, key)
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  definition jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_status_check check (status in ('draft', 'active', 'paused', 'archived')),
  constraint workflows_organization_key_unique unique (organization_id, key)
);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'task',
  status text not null default 'open',
  priority text not null default 'normal',
  source_type text,
  source_id uuid,
  assignee_user_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_items_status_check check (
    status in ('open', 'queued', 'in_progress', 'blocked', 'completed', 'cancelled')
  ),
  constraint work_items_priority_check check (priority in ('low', 'normal', 'high', 'urgent'))
);

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid references public.workflows(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  status text not null default 'queued',
  trigger_type text,
  trigger_payload jsonb not null default '{}'::jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_runs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  key text not null,
  name text not null,
  step_order integer not null,
  type text not null default 'agent',
  agent_id uuid references public.agents(id) on delete set null,
  tool_id uuid references public.tools(id) on delete set null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_steps_step_order_check check (step_order >= 0),
  constraint workflow_steps_type_check check (type in ('agent', 'tool', 'review', 'condition', 'action')),
  constraint workflow_steps_workflow_key_unique unique (workflow_id, key),
  constraint workflow_steps_workflow_order_unique unique (workflow_id, step_order)
);

create table if not exists public.agent_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  workflow_run_id uuid references public.workflow_runs(id) on delete set null,
  workflow_step_id uuid references public.workflow_steps(id) on delete set null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_executions_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

create table if not exists public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_execution_id uuid references public.agent_executions(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  decision_type text not null,
  decision jsonb not null default '{}'::jsonb,
  rationale text,
  confidence numeric(5, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint agent_decisions_confidence_check check (
    confidence is null or (confidence >= 0 and confidence <= 1)
  )
);

create table if not exists public.human_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_item_id uuid references public.work_items(id) on delete set null,
  agent_execution_id uuid references public.agent_executions(id) on delete set null,
  agent_decision_id uuid references public.agent_decisions(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending',
  review_type text not null default 'approval',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb,
  decision text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_reviews_status_check check (
    status in ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled')
  ),
  constraint human_reviews_decision_check check (
    decision is null or decision in ('approve', 'reject', 'request_changes')
  )
);

create table if not exists public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  source_agent_execution_id uuid references public.agent_executions(id) on delete set null,
  scope text not null default 'organization',
  key text,
  content text not null,
  embedding vector,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_entries_scope_check check (scope in ('organization', 'agent', 'work_item'))
);

create table if not exists public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_execution_id uuid references public.agent_executions(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  tool_id uuid references public.tools(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_tool_calls_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')
  )
);

create index if not exists agents_organization_id_idx
  on public.agents(organization_id);

create unique index if not exists agents_id_organization_id_idx
  on public.agents(id, organization_id);

create index if not exists agents_organization_status_idx
  on public.agents(organization_id, status);

create index if not exists tools_organization_id_idx
  on public.tools(organization_id);

create unique index if not exists tools_id_organization_id_idx
  on public.tools(id, organization_id);

create index if not exists tools_organization_enabled_idx
  on public.tools(organization_id, is_enabled);

create index if not exists workflows_organization_id_idx
  on public.workflows(organization_id);

create unique index if not exists workflows_id_organization_id_idx
  on public.workflows(id, organization_id);

create index if not exists workflows_organization_status_idx
  on public.workflows(organization_id, status);

create index if not exists work_items_organization_id_idx
  on public.work_items(organization_id);

create unique index if not exists work_items_id_organization_id_idx
  on public.work_items(id, organization_id);

create index if not exists work_items_organization_status_idx
  on public.work_items(organization_id, status);

create index if not exists work_items_organization_priority_idx
  on public.work_items(organization_id, priority);

create index if not exists work_items_assignee_user_id_idx
  on public.work_items(assignee_user_id);

create index if not exists work_items_source_idx
  on public.work_items(organization_id, source_type, source_id);

create index if not exists workflow_runs_organization_id_idx
  on public.workflow_runs(organization_id);

create unique index if not exists workflow_runs_id_organization_id_idx
  on public.workflow_runs(id, organization_id);

create index if not exists workflow_runs_workflow_id_idx
  on public.workflow_runs(workflow_id);

create index if not exists workflow_runs_work_item_id_idx
  on public.workflow_runs(work_item_id);

create index if not exists workflow_runs_organization_status_idx
  on public.workflow_runs(organization_id, status);

create index if not exists workflow_steps_organization_id_idx
  on public.workflow_steps(organization_id);

create unique index if not exists workflow_steps_id_organization_id_idx
  on public.workflow_steps(id, organization_id);

create index if not exists workflow_steps_workflow_id_idx
  on public.workflow_steps(workflow_id);

create index if not exists workflow_steps_agent_id_idx
  on public.workflow_steps(agent_id);

create index if not exists workflow_steps_tool_id_idx
  on public.workflow_steps(tool_id);

create index if not exists agent_executions_organization_id_idx
  on public.agent_executions(organization_id);

create unique index if not exists agent_executions_id_organization_id_idx
  on public.agent_executions(id, organization_id);

create index if not exists agent_executions_agent_id_idx
  on public.agent_executions(agent_id);

create index if not exists agent_executions_work_item_id_idx
  on public.agent_executions(work_item_id);

create index if not exists agent_executions_workflow_run_id_idx
  on public.agent_executions(workflow_run_id);

create index if not exists agent_executions_organization_status_idx
  on public.agent_executions(organization_id, status);

create index if not exists agent_decisions_organization_id_idx
  on public.agent_decisions(organization_id);

create unique index if not exists agent_decisions_id_organization_id_idx
  on public.agent_decisions(id, organization_id);

create index if not exists agent_decisions_agent_execution_id_idx
  on public.agent_decisions(agent_execution_id);

create index if not exists agent_decisions_agent_id_idx
  on public.agent_decisions(agent_id);

create index if not exists agent_decisions_work_item_id_idx
  on public.agent_decisions(work_item_id);

create index if not exists human_reviews_organization_id_idx
  on public.human_reviews(organization_id);

create index if not exists human_reviews_work_item_id_idx
  on public.human_reviews(work_item_id);

create index if not exists human_reviews_agent_execution_id_idx
  on public.human_reviews(agent_execution_id);

create index if not exists human_reviews_reviewer_user_id_idx
  on public.human_reviews(reviewer_user_id);

create index if not exists human_reviews_organization_status_idx
  on public.human_reviews(organization_id, status);

create index if not exists memory_entries_organization_id_idx
  on public.memory_entries(organization_id);

create index if not exists memory_entries_agent_id_idx
  on public.memory_entries(agent_id);

create index if not exists memory_entries_work_item_id_idx
  on public.memory_entries(work_item_id);

create index if not exists memory_entries_source_agent_execution_id_idx
  on public.memory_entries(source_agent_execution_id);

create index if not exists memory_entries_organization_scope_idx
  on public.memory_entries(organization_id, scope);

create index if not exists memory_entries_organization_key_idx
  on public.memory_entries(organization_id, key)
  where key is not null;

create index if not exists agent_tool_calls_organization_id_idx
  on public.agent_tool_calls(organization_id);

create index if not exists agent_tool_calls_agent_execution_id_idx
  on public.agent_tool_calls(agent_execution_id);

create index if not exists agent_tool_calls_agent_id_idx
  on public.agent_tool_calls(agent_id);

create index if not exists agent_tool_calls_tool_id_idx
  on public.agent_tool_calls(tool_id);

create index if not exists agent_tool_calls_work_item_id_idx
  on public.agent_tool_calls(work_item_id);

create index if not exists agent_tool_calls_organization_status_idx
  on public.agent_tool_calls(organization_id, status);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'workflow_runs_workflow_org_fk') then
    alter table public.workflow_runs
      add constraint workflow_runs_workflow_org_fk
      foreign key (workflow_id, organization_id)
      references public.workflows(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workflow_runs_work_item_org_fk') then
    alter table public.workflow_runs
      add constraint workflow_runs_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workflow_steps_workflow_org_fk') then
    alter table public.workflow_steps
      add constraint workflow_steps_workflow_org_fk
      foreign key (workflow_id, organization_id)
      references public.workflows(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workflow_steps_agent_org_fk') then
    alter table public.workflow_steps
      add constraint workflow_steps_agent_org_fk
      foreign key (agent_id, organization_id)
      references public.agents(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'workflow_steps_tool_org_fk') then
    alter table public.workflow_steps
      add constraint workflow_steps_tool_org_fk
      foreign key (tool_id, organization_id)
      references public.tools(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_executions_agent_org_fk') then
    alter table public.agent_executions
      add constraint agent_executions_agent_org_fk
      foreign key (agent_id, organization_id)
      references public.agents(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_executions_work_item_org_fk') then
    alter table public.agent_executions
      add constraint agent_executions_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_executions_workflow_run_org_fk') then
    alter table public.agent_executions
      add constraint agent_executions_workflow_run_org_fk
      foreign key (workflow_run_id, organization_id)
      references public.workflow_runs(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_executions_workflow_step_org_fk') then
    alter table public.agent_executions
      add constraint agent_executions_workflow_step_org_fk
      foreign key (workflow_step_id, organization_id)
      references public.workflow_steps(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_decisions_agent_execution_org_fk') then
    alter table public.agent_decisions
      add constraint agent_decisions_agent_execution_org_fk
      foreign key (agent_execution_id, organization_id)
      references public.agent_executions(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_decisions_agent_org_fk') then
    alter table public.agent_decisions
      add constraint agent_decisions_agent_org_fk
      foreign key (agent_id, organization_id)
      references public.agents(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_decisions_work_item_org_fk') then
    alter table public.agent_decisions
      add constraint agent_decisions_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'human_reviews_work_item_org_fk') then
    alter table public.human_reviews
      add constraint human_reviews_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'human_reviews_agent_execution_org_fk') then
    alter table public.human_reviews
      add constraint human_reviews_agent_execution_org_fk
      foreign key (agent_execution_id, organization_id)
      references public.agent_executions(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'human_reviews_agent_decision_org_fk') then
    alter table public.human_reviews
      add constraint human_reviews_agent_decision_org_fk
      foreign key (agent_decision_id, organization_id)
      references public.agent_decisions(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_entries_agent_org_fk') then
    alter table public.memory_entries
      add constraint memory_entries_agent_org_fk
      foreign key (agent_id, organization_id)
      references public.agents(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_entries_work_item_org_fk') then
    alter table public.memory_entries
      add constraint memory_entries_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'memory_entries_source_execution_org_fk') then
    alter table public.memory_entries
      add constraint memory_entries_source_execution_org_fk
      foreign key (source_agent_execution_id, organization_id)
      references public.agent_executions(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_tool_calls_agent_execution_org_fk') then
    alter table public.agent_tool_calls
      add constraint agent_tool_calls_agent_execution_org_fk
      foreign key (agent_execution_id, organization_id)
      references public.agent_executions(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_tool_calls_agent_org_fk') then
    alter table public.agent_tool_calls
      add constraint agent_tool_calls_agent_org_fk
      foreign key (agent_id, organization_id)
      references public.agents(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_tool_calls_tool_org_fk') then
    alter table public.agent_tool_calls
      add constraint agent_tool_calls_tool_org_fk
      foreign key (tool_id, organization_id)
      references public.tools(id, organization_id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'agent_tool_calls_work_item_org_fk') then
    alter table public.agent_tool_calls
      add constraint agent_tool_calls_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id);
  end if;
end $$;

alter table public.agents enable row level security;
alter table public.tools enable row level security;
alter table public.workflows enable row level security;
alter table public.work_items enable row level security;
alter table public.workflow_runs enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.agent_executions enable row level security;
alter table public.agent_decisions enable row level security;
alter table public.human_reviews enable row level security;
alter table public.memory_entries enable row level security;
alter table public.agent_tool_calls enable row level security;

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'agents',
    'tools',
    'workflows',
    'work_items',
    'workflow_runs',
    'workflow_steps',
    'agent_executions',
    'agent_decisions',
    'human_reviews',
    'memory_entries',
    'agent_tool_calls'
  ]
  loop
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
  end loop;
end $$;
