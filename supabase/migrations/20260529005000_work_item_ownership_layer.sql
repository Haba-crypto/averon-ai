-- Phase 12: Work item ownership layer.
--
-- Additive and idempotent:
-- - tracks current work item owner without changing existing work item ids;
-- - preserves legacy assignee_user_id and metadata fields;
-- - stores ownership changes as agent_decisions with decision_type = ownership_change.

alter table if exists public.work_items
  add column if not exists owner_type text not null default 'unassigned',
  add column if not exists owner_agent_id uuid references public.agents(id) on delete set null,
  add column if not exists owner_agent_name text,
  add column if not exists owner_agent_role text,
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists ownership_status text not null default 'unassigned',
  add column if not exists last_owner_change_at timestamptz,
  add column if not exists last_owner_change_reason text;

create index if not exists work_items_organization_owner_type_idx
  on public.work_items(organization_id, owner_type);

create index if not exists work_items_owner_agent_id_idx
  on public.work_items(owner_agent_id)
  where owner_agent_id is not null;

create index if not exists work_items_owner_user_id_idx
  on public.work_items(owner_user_id)
  where owner_user_id is not null;

create index if not exists work_items_ownership_status_idx
  on public.work_items(organization_id, ownership_status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_items_owner_type_check'
  ) then
    alter table public.work_items
      add constraint work_items_owner_type_check
      check (owner_type in ('ai', 'human', 'shared', 'unassigned'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_items_ownership_status_check'
  ) then
    alter table public.work_items
      add constraint work_items_ownership_status_check
      check (ownership_status in ('unassigned', 'assigned', 'transferred', 'human_review'))
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_items_owner_agent_org_fk'
  ) then
    alter table public.work_items
      add constraint work_items_owner_agent_org_fk
      foreign key (owner_agent_id, organization_id)
      references public.agents(id, organization_id)
      not valid;
  end if;
end $$;
