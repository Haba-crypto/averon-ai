-- Phase 19: Queue Orchestrator support.
--
-- Additive and idempotent:
-- - records why controlled queue processing failed without introducing
--   autonomous execution.

alter table public.execution_queue
  add column if not exists failure_reason text;

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
        'active',
        'blocked',
        'completed'
      )
    )
    not valid;
end $$;
