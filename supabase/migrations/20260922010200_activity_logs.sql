-- ============================================================================
-- 0003: ACTIVITY_LOGS
--
-- A running history of "who did what". Every time someone creates, edits, or
-- deletes something in the app, we'll write one row here. This is what lets
-- an admin later answer "who marked this item as sold?" or "who deleted this
-- package?". We're creating the table now; the app doesn't write to it yet
-- until the inventory features exist.
-- ============================================================================

create table if not exists public.activity_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid references public.profiles (id) on delete set null,
  action       text not null,                 -- e.g. 'item.created', 'item.sold'
  entity_type  text,                           -- e.g. 'item', 'package', 'account'
  entity_id    text,                           -- the id of the thing that was changed
  metadata     jsonb not null default '{}'::jsonb,  -- any extra details, freeform
  created_at   timestamptz not null default now()
);

comment on table public.activity_logs is 'Audit trail: one row per meaningful action taken in the app.';

-- These indexes match how we'll actually query this table later:
-- "show me everything user X did" / "show the most recent activity" /
-- "show all activity on this specific item".
create index if not exists idx_activity_logs_user_id on public.activity_logs (user_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_entity on public.activity_logs (entity_type, entity_id);

alter table public.activity_logs enable row level security;
