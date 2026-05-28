-- Phase 2 verification SQL.
-- Run after applying 20260529002000_work_item_backfill.sql.

select
  'leads_missing_work_items' as check_name,
  count(*) as count
from public.leads l
where l.organization_id is not null
  and not exists (
    select 1
    from public.work_items wi
    where wi.organization_id = l.organization_id
      and wi.source_type = 'lead'
      and wi.source_id = l.id
      and wi.lead_id = l.id
      and wi.type = 'lead_acquisition'
  );

select
  'duplicate_lead_work_items' as check_name,
  count(*) as duplicate_groups
from (
  select organization_id, source_id
  from public.work_items
  where source_type = 'lead'
    and source_id is not null
  group by organization_id, source_id
  having count(*) > 1
) duplicate_sources;

select
  'tasks_missing_work_item_id' as check_name,
  count(*) as count
from public.tasks t
where t.lead_id is not null
  and t.work_item_id is null;

select
  'conversations_missing_work_item_id' as check_name,
  count(*) as count
from public.conversations c
where c.lead_id is not null
  and c.work_item_id is null;

select
  'ai_events_missing_work_item_id' as check_name,
  count(*) as count
from public.ai_events e
where e.lead_id is not null
  and e.work_item_id is null;

select
  'work_item_status_distribution' as check_name,
  status,
  count(*) as count
from public.work_items
where source_type = 'lead'
group by status
order by status;

select
  'work_item_priority_distribution' as check_name,
  priority,
  count(*) as count
from public.work_items
where source_type = 'lead'
group by priority
order by priority;
