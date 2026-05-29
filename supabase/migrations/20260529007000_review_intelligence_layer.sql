-- Phase 15: Review Intelligence Layer.
--
-- Adds operator-ready briefing fields to human review requests.

alter table if exists public.human_reviews
  add column if not exists review_title text,
  add column if not exists review_summary text,
  add column if not exists review_context jsonb,
  add column if not exists recommended_action text;
