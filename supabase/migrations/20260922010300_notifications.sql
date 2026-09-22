-- ============================================================================
-- 0004: NOTIFICATIONS
--
-- In-app notifications, one row per notification per recipient. For example:
-- an admin could later send "Reminder: post your assigned items today" to a
-- specific worker, or the system could notify an admin "an account was
-- disabled". user_id is who RECEIVES it; created_by is who SENT it
-- (null if the system generated it automatically rather than a person).
-- ============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  title       text not null,
  message     text,
  type        text not null default 'info' check (type in ('info', 'success', 'warning', 'error')),
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is 'In-app notifications, one row per recipient.';

-- Matches the app's main query: "give this user their unread notifications,
-- newest first".
create index if not exists idx_notifications_user_unread on public.notifications (user_id, is_read);
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);

alter table public.notifications enable row level security;
