-- Phase 6: connect extracted conversation memory to leads and prevent repeats.

alter table if exists public.memory_entries
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists memory_entries_lead_id_idx
  on public.memory_entries(lead_id)
  where lead_id is not null;

create index if not exists memory_entries_organization_lead_idx
  on public.memory_entries(organization_id, lead_id)
  where lead_id is not null;

create unique index if not exists memory_entries_organization_lead_key_unique_idx
  on public.memory_entries(organization_id, lead_id, key);
