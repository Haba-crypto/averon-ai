-- Phase 17: Execution resume preparation layer.
--
-- Approved human reviews can return work to an AI owner without starting
-- autonomous execution. The ready_to_resume status marks that handoff point.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'work_items_ownership_status_check'
  ) then
    alter table public.work_items
      drop constraint work_items_ownership_status_check;
  end if;

  alter table public.work_items
    add constraint work_items_ownership_status_check
    check (
      ownership_status in (
        'unassigned',
        'assigned',
        'transferred',
        'human_review',
        'ready_to_resume',
        'blocked',
        'completed'
      )
    )
    not valid;
end $$;
