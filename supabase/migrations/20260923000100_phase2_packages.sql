-- ============================================================================
-- PHASE 2 - 0010: PACKAGES
--
-- Maps from the original app's hauls.chapters[].packages[]. A package is one
-- shipment/box within a chapter (original JSON's package.title, .date, etc.)
-- ============================================================================

create table if not exists public.packages (
  id               uuid primary key default gen_random_uuid(),
  chapter_id       uuid not null references public.chapters (id) on delete cascade,
  title            text not null,
  package_number   integer,
  package_date     text,                 -- kept as free text - original data isn't a real calendar date (e.g. "21.4")
  info             text,
  shipping_cost    numeric(10, 2) not null default 0,
  shipping_code    text,                 -- tracking number, when present
  arrival_status   text check (arrival_status in ('arrived', 'arriving')),

  -- --- import / legacy tracking ---
  legacy_id        text unique,          -- original package.id, e.g. "pkg-abc123"
  legacy_raw       jsonb,                -- full original package object (minus its "items" array, which becomes inventory_items rows)

  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.packages is 'One shipment/box within a chapter. Maps from hauls.chapters[].packages[]; the old moneySpent/moneyWon/profit fields are now calculated instead of stored - see the note in the chapters migration.';

create index if not exists idx_packages_chapter_id on public.packages (chapter_id);
create index if not exists idx_packages_legacy_id on public.packages (legacy_id);
create index if not exists idx_packages_arrival_status on public.packages (arrival_status);

create trigger trg_packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

alter table public.packages enable row level security;

create policy "packages_select_authenticated"
  on public.packages for select
  to authenticated
  using (true);

create policy "packages_insert_authenticated"
  on public.packages for insert
  to authenticated
  with check (true);

create policy "packages_update_authenticated"
  on public.packages for update
  to authenticated
  using (true)
  with check (true);

create policy "packages_delete_admin"
  on public.packages for delete
  to authenticated
  using (public.is_admin());
