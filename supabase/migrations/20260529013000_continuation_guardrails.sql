-- Phase 24: Controlled continuation guardrails.
--
-- Additive and idempotent:
-- - stores continuation policy metadata on generated queue items;
-- - preserves manual processing only, with no autonomous execution.

alter table public.execution_queue
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists execution_queue_continuation_metadata_idx
  on public.execution_queue using gin (metadata)
  where metadata ? 'continuation_mode';
