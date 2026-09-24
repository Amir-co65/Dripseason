-- ============================================================================
-- PHASE 2 - 0019: CLOSET_SECTIONS + CLOSET_ITEMS
--
-- Maps from the original app's closet.sections[] (a physical storage
-- location - a shelf, a box, a hanger - each holding a list of item IDs).
--
-- The old data stored this as an array of item IDs sitting ON the section.
-- Here it's the more standard relational shape instead: one row per
-- (item, section) pairing, which is exactly equivalent in meaning but
-- easier to query both directions ("what's in this section" AND "which
-- section is this item in").
--
-- NOTE: inventory_items already has a free-text closet_location column
-- (from migration 0011), added before this table existed. Once this table
-- is populated, closet_items is the real source of truth for where an
-- item is stored - closet_location becomes a legacy fallback (useful for
-- any imported item that references a location by name only, before it's
-- matched up to a real closet_sections row).
-- ============================================================================

create table if not exists public.closet_sections (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,

  legacy_id    text unique,
  legacy_raw   jsonb,

  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.closet_sections is 'A physical storage spot (shelf, box, hanger). Maps from closet.sections[].';

create trigger trg_closet_sections_set_updated_at
  before update on public.closet_sections
  for each row execute function public.set_updated_at();

create table if not exists public.closet_items (
  id                  uuid primary key default gen_random_uuid(),
  closet_section_id   uuid not null references public.closet_sections (id) on delete cascade,
  -- unique: an item lives in exactly one place at a time (same rule the
  -- old app followed in practice, even though its array-based storage
  -- didn't technically enforce it).
  inventory_item_id   uuid not null unique references public.inventory_items (id) on delete cascade,

  created_at          timestamptz not null default now()
);

comment on table public.closet_items is 'Which section each item is stored in. Maps from closet.sections[].itemIds[], reshaped into one row per item.';

create index if not exists idx_closet_items_section_id on public.closet_items (closet_section_id);

alter table public.closet_sections enable row level security;
alter table public.closet_items enable row level security;

create policy "closet_sections_select_authenticated"
  on public.closet_sections for select to authenticated using (true);
create policy "closet_sections_insert_authenticated"
  on public.closet_sections for insert to authenticated with check (true);
create policy "closet_sections_update_authenticated"
  on public.closet_sections for update to authenticated using (true) with check (true);
create policy "closet_sections_delete_admin"
  on public.closet_sections for delete to authenticated using (public.is_admin());

create policy "closet_items_select_authenticated"
  on public.closet_items for select to authenticated using (true);
create policy "closet_items_insert_authenticated"
  on public.closet_items for insert to authenticated with check (true);
create policy "closet_items_delete_authenticated"
  on public.closet_items for delete to authenticated using (true);
