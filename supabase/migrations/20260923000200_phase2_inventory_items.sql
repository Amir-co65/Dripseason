-- ============================================================================
-- PHASE 2 - 0011: INVENTORY_ITEMS
--
-- The core table. Maps from the original app's hauls.chapters[].packages[]
-- .items[] (unsold + sold items both live here now - "status" is what used
-- to split them across the old app's Available/Sold views).
-- ============================================================================

create table if not exists public.inventory_items (
  id                uuid primary key default gen_random_uuid(),

  sku               text unique,          -- NEW field for this phase - see note below
  item_name         text not null,
  brand             text,                 -- NEW - old data didn't track this separately; starts null, fillable later
  category          text,                 -- kept as free text on purpose - old data has fine-grained values like
                                           -- "Hoodies", "Shorts", "Jewelry" etc. Forcing them into a fixed set now
                                           -- would lose information; a controlled list can be layered on top later.
  size              text,                 -- NEW
  color             text,                 -- NEW
  description       text,                 -- NEW, separate from "notes" below
  notes             text,                 -- old item.notes, preserved as-is

  purchase_price    numeric(10, 2),       -- old item.boughtFor
  asking_price      numeric(10, 2) not null default 0,  -- old item.sellFor
  sold_price        numeric(10, 2),       -- old item.soldFor (also duplicated on the sales table - see note there)

  status            text not null default 'available'
                       check (status in ('available', 'listed', 'sold', 'traded', 'archived')),
                       -- old item.status was just 'Unsold' / 'Sold'. Mapping: 'Unsold' -> 'available',
                       -- 'Sold' -> 'sold'. 'listed', 'traded', 'archived' are new states this phase adds.

  package_id        uuid references public.packages (id) on delete set null,
  closet_location   text,                 -- free text for now; will likely become a proper closet_items FK
                                           -- once the closet schema is built in a later phase - not lost, just
                                           -- not yet relational.

  -- --- import / legacy tracking ---
  legacy_id         text unique,          -- original item.id
  legacy_public_id  text unique,          -- original item.publicId, e.g. "000a0" / "843b0" - the human-facing ID
                                           -- your whole business already uses. Keep using these on packing
                                           -- slips etc. until/unless you switch fully to the new sku field.
  legacy_raw        jsonb,                -- full original item object (includes odd extra fields your real
                                           -- data actually has, like "row" and "raw", so nothing is dropped)

  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.inventory_items is 'One physical item. Maps from hauls...items[]. sold_price is also recorded on the sales table when a sale happens - see the sales migration for why both exist.';
comment on column public.inventory_items.sku is 'New in Phase 2 - your own internal code if you want one. Not required; legacy_public_id is what your existing labels/IDs already use.';

create index if not exists idx_inventory_items_package_id on public.inventory_items (package_id);
create index if not exists idx_inventory_items_status on public.inventory_items (status);
create index if not exists idx_inventory_items_category on public.inventory_items (category);
create index if not exists idx_inventory_items_legacy_public_id on public.inventory_items (legacy_public_id);

create trigger trg_inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

-- Both roles can see and manage inventory rows - that's the operational
-- data workers need day to day. The MONEY COLUMNS on this same table
-- (purchase_price, asking_price, sold_price) are masked from workers, but
-- masking happens through a secure view, not by hiding whole rows - see
-- migration 0014. RLS below controls which ROWS are visible, which for
-- this table is "all of them, for any logged-in person" - that part is
-- intentionally the same for both roles.
create policy "inventory_items_select_authenticated"
  on public.inventory_items for select
  to authenticated
  using (true);

create policy "inventory_items_insert_authenticated"
  on public.inventory_items for insert
  to authenticated
  with check (true);

create policy "inventory_items_update_authenticated"
  on public.inventory_items for update
  to authenticated
  using (true)
  with check (true);

-- Deleting an item outright (as opposed to marking it 'archived') is
-- restricted to admins, to match "workers can add/edit, not destroy".
create policy "inventory_items_delete_admin"
  on public.inventory_items for delete
  to authenticated
  using (public.is_admin());
