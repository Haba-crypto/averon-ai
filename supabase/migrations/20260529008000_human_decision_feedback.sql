-- Phase 16: Human decision feedback loop.
--
-- Allow terminal human review decisions to feed ownership state back to
-- work_items without changing existing ownership rows.

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
        'blocked',
        'completed'
      )
    )
    not valid;
end $$;
