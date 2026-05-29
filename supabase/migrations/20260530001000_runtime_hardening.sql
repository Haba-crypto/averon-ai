-- Phase 32: Production runtime hardening.
--
-- Additive and idempotent:
-- - stores queue lease metadata for controlled one-item claims;
-- - records retry/error/failure timestamps without adding workers;
-- - preserves existing manual execution behavior.

alter table public.execution_queue
  add column if not exists lease_owner text,
  add column if not exists lease_until timestamptz,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists failed_at timestamptz;

create index if not exists execution_queue_ready_lease_idx
  on public.execution_queue(organization_id, status, lease_until)
  where status = 'ready';

create index if not exists execution_queue_failed_at_idx
  on public.execution_queue(organization_id, failed_at desc)
  where failed_at is not null;
