-- Phase 2: compatibility/backfill layer for legacy lead-centered work.
--
-- This migration is intentionally additive and idempotent:
-- - creates one lead_acquisition work_item per existing lead;
-- - links legacy tasks, conversations, and ai_events to that work_item;
-- - avoids overwriting existing work_item_id values;
-- - adds compatibility columns/indexes/constraints without replacing legacy tables.

alter table if exists public.work_items
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

alter table if exists public.tasks
  add column if not exists work_item_id uuid references public.work_items(id) on delete set null;

alter table if exists public.conversations
  add column if not exists work_item_id uuid references public.work_items(id) on delete set null;

alter table if exists public.ai_events
  add column if not exists work_item_id uuid references public.work_items(id) on delete set null;

create index if not exists work_items_lead_id_idx
  on public.work_items(lead_id)
  where lead_id is not null;

create unique index if not exists work_items_lead_source_unique_idx
  on public.work_items(organization_id, source_type, source_id)
  where source_type = 'lead'
    and source_id is not null;

create index if not exists tasks_work_item_id_idx
  on public.tasks(work_item_id)
  where work_item_id is not null;

create index if not exists conversations_work_item_id_idx
  on public.conversations(work_item_id)
  where work_item_id is not null;

create index if not exists ai_events_work_item_id_idx
  on public.ai_events(work_item_id)
  where work_item_id is not null;

create unique index if not exists leads_id_organization_id_idx
  on public.leads(id, organization_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'work_items_lead_org_fk'
  ) then
    alter table public.work_items
      add constraint work_items_lead_org_fk
      foreign key (lead_id, organization_id)
      references public.leads(id, organization_id)
      not valid;
  end if;

  if to_regclass('public.tasks') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'tasks_work_item_org_fk'
    )
  then
    alter table public.tasks
      add constraint tasks_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id)
      not valid;
  end if;

  if to_regclass('public.conversations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'conversations_work_item_org_fk'
    )
  then
    alter table public.conversations
      add constraint conversations_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id)
      not valid;
  end if;

  if to_regclass('public.ai_events') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'ai_events_work_item_org_fk'
    )
  then
    alter table public.ai_events
      add constraint ai_events_work_item_org_fk
      foreign key (work_item_id, organization_id)
      references public.work_items(id, organization_id)
      not valid;
  end if;
end $$;

insert into public.work_items (
  organization_id,
  title,
  type,
  status,
  priority,
  source_type,
  source_id,
  lead_id,
  metadata,
  created_at,
  updated_at
)
select
  l.organization_id,
  coalesce(
    nullif(
      concat_ws(
        ' - ',
        nullif(trim(l.name), ''),
        nullif(trim(l.email), '')
      ),
      ''
    ),
    'Lead ' || left(l.id::text, 8)
  ) as title,
  'lead_acquisition' as type,
  case
    when lower(coalesce(l.status, '')) in (
      'closed_won',
      'converted',
      'customer',
      'won'
    ) then 'completed'
    when lower(coalesce(l.status, '')) in (
      'closed_lost',
      'disqualified',
      'lost',
      'unqualified'
    ) then 'cancelled'
    when lower(coalesce(l.status, '')) in (
      'blocked',
      'stalled'
    ) then 'blocked'
    when lower(coalesce(l.status, '')) in (
      'approved',
      'contacted',
      'demo_scheduled',
      'execution_active',
      'proposal',
      'qualified'
    ) then 'in_progress'
    when lower(coalesce(l.status, '')) in (
      'new',
      'nurture',
      'pending'
    ) then 'open'
    else 'open'
  end as status,
  case
    when lower(coalesce(l.urgency, '')) in ('critical', 'urgent')
      or coalesce(l.intent_score, 0) >= 85 then 'urgent'
    when lower(coalesce(l.urgency, '')) = 'high'
      or coalesce(l.intent_score, 0) >= 70 then 'high'
    when lower(coalesce(l.urgency, '')) = 'low'
      and coalesce(l.intent_score, 0) < 25 then 'low'
    else 'normal'
  end as priority,
  'lead' as source_type,
  l.id as source_id,
  l.id as lead_id,
  jsonb_strip_nulls(
    jsonb_build_object(
      'backfill', 'phase_2_work_item_backfill',
      'lead_status', l.status,
      'lead_urgency', l.urgency,
      'intent_score', l.intent_score
    )
  ) as metadata,
  coalesce(l.created_at, now()) as created_at,
  now() as updated_at
from public.leads l
where l.organization_id is not null
  and not exists (
    select 1
    from public.work_items wi
    where wi.organization_id = l.organization_id
      and wi.source_type = 'lead'
      and wi.source_id = l.id
  );

update public.tasks t
set work_item_id = wi.id
from public.work_items wi
where t.work_item_id is null
  and t.lead_id = wi.lead_id
  and wi.source_type = 'lead'
  and (
    t.organization_id = wi.organization_id
    or t.organization_id is null
  );

update public.conversations c
set work_item_id = wi.id
from public.work_items wi
where c.work_item_id is null
  and c.lead_id = wi.lead_id
  and wi.source_type = 'lead'
  and (
    c.organization_id = wi.organization_id
    or c.organization_id is null
  );

update public.ai_events e
set work_item_id = wi.id
from public.work_items wi
where e.work_item_id is null
  and e.lead_id = wi.lead_id
  and wi.source_type = 'lead'
  and (
    e.organization_id = wi.organization_id
    or e.organization_id is null
  );
