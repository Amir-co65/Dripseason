-- ============================================================================
-- 0002: PROFILES
--
-- Supabase Auth already has a built-in, hidden table called "auth.users" that
-- stores emails and passwords. We never touch that table directly. Instead we
-- keep a "public.profiles" row for each user, with the extra info our app
-- actually needs (their name, and importantly, their ROLE).
--
-- profiles.id is both the primary key AND a foreign key pointing at
-- auth.users.id, so every profile is always tied to exactly one login.
-- ============================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null unique,
  full_name     text,
  avatar_url    text,
  role          text not null default 'worker' check (role in ('admin', 'worker')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'One row per user, extending auth.users with app-specific fields like role.';
comment on column public.profiles.role is 'Access level: admin (full access) or worker (limited access). Never trust this value from client input alone.';

-- Fast lookups when the app filters/sorts by role (e.g. "show me all workers").
create index if not exists idx_profiles_role on public.profiles (role);

-- Turn on Row Level Security. Until we add policies (migration 0005),
-- this table is completely locked down - nobody can read or write it,
-- not even logged-in users. That's the safe default to start from.
alter table public.profiles enable row level security;
