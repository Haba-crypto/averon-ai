-- Phase 23: Work Generation layer.
--
-- Additive and idempotent:
-- - links generated follow-up work to its parent work item;
-- - prevents duplicate generated follow-up work for the same parent/capability;
-- - does not process generated queue items autonomously.

alter table if exists public.work_items
  add column if not exists parent_work_item_id uuid references public.work_items(id) on delete set null;

create index if not exists work_items_parent_work_item_id_idx
  on public.work_items(parent_work_item_id)
  where parent_work_item_id is not null;

create index if not exists work_items_organization_parent_idx
  on public.work_items(organization_id, parent_work_item_id)
  where parent_work_item_id is not null;

create unique index if not exists work_items_follow_up_generation_unique_idx
  on public.work_items(
    organization_id,
    parent_work_item_id,
    ((metadata ->> 'capability_id'))
  )
  where type = 'follow_up'
    and source_type = 'capability'
    and metadata ->> 'source' = 'capability_work_generation'
    and parent_work_item_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_items_parent_work_item_org_fk'
  ) then
    alter table public.work_items
      add constraint work_items_parent_work_item_org_fk
      foreign key (parent_work_item_id, organization_id)
      references public.work_items(id, organization_id)
      not valid;
  end if;
end $$;
