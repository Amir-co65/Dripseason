-- ============================================================================
-- PHASE 2 - 0013: SALES
--
-- Maps from the original app's sold.items[]. One row per completed sale.
--
-- WHY sold_price EXISTS ON BOTH inventory_items AND sales:
-- inventory_items.sold_price is "what this item most recently sold for" -
-- handy for a quick look at the item itself. sales.sold_price is the
-- permanent transaction record. In the old app these could briefly
-- disagree if an item was "unsold" and resold; here, the trigger below
-- keeps inventory_items.sold_price in sync automatically, and the sales
-- table remains the actual source of truth / history.
-- ============================================================================

create table if not exists public.sales (
  id                          uuid primary key default gen_random_uuid(),
  inventory_item_id           uuid not null references public.inventory_items (id) on delete restrict,

  sold_price                  numeric(10, 2) not null,
  sale_date                   date,
  sale_platform               text,           -- old salePlace: 'Vinted' / 'Plick' / 'Cash' / 'Other' / 'Gift'
  buyer_note                  text,

  -- Filled in once the marketplace_accounts table exists (a later phase).
  -- Left nullable, with no foreign key yet, on purpose - see the note in
  -- the top-level message about why this column has no constraint yet.
  marketplace_account_id      uuid,

  -- --- import / legacy tracking ---
  legacy_id                   text unique,           -- original sold-item id
  legacy_source_chapter_name  text,                  -- old sourceChapterName (kept as text since the chapter
                                                      -- itself may have been renamed/deleted since the sale)
  legacy_source_package_title text,                  -- old sourcePackageTitle, same reasoning
  legacy_sale_account_label   text,                  -- old saleAccountLabel, until marketplace_account_id is wired up
  legacy_sale_account_number  text,                  -- old saleAccountNumber
  legacy_raw                  jsonb,                 -- full original sold-item object

  created_by                  uuid references public.profiles (id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

comment on table public.sales is 'One row per completed sale. Maps from the original sold.items[]. This is an append-heavy history table, similar in spirit to activity_logs.';

create index if not exists idx_sales_inventory_item_id on public.sales (inventory_item_id);
create index if not exists idx_sales_sale_date on public.sales (sale_date desc);
create index if not exists idx_sales_sale_platform on public.sales (sale_platform);

create trigger trg_sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Keep inventory_items.status/sold_price in sync with sales rows automatically,
-- the same way the original app recalculated everything after every action.
-- Recording a sale -> item flips to 'sold'. Deleting that sale (i.e. an
-- "unsell", like the old app's Unsell button) -> item reverts to 'available'
-- if no other sale exists for it.
-- ----------------------------------------------------------------------------
create or replace function public.sync_inventory_item_on_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.inventory_items
       set status = 'sold', sold_price = new.sold_price
     where id = new.inventory_item_id;

  elsif TG_OP = 'DELETE' then
    if not exists (
      select 1 from public.sales
      where inventory_item_id = old.inventory_item_id and id <> old.id
    ) then
      update public.inventory_items
         set status = 'available', sold_price = null
       where id = old.inventory_item_id;
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_sync_inventory_item_on_sale_insert
  after insert on public.sales
  for each row execute function public.sync_inventory_item_on_sale();

create trigger trg_sync_inventory_item_on_sale_delete
  after delete on public.sales
  for each row execute function public.sync_inventory_item_on_sale();

alter table public.sales enable row level security;

create policy "sales_select_authenticated"
  on public.sales for select
  to authenticated
  using (true);

-- "Workers can mark sold" -> workers can insert a sale row.
create policy "sales_insert_authenticated"
  on public.sales for insert
  to authenticated
  with check (true);

create policy "sales_update_authenticated"
  on public.sales for update
  to authenticated
  using (true)
  with check (true);

-- Deleting a sale record (the "unsell" action) is restricted to admins -
-- letting any worker erase a completed sale from the books is too risky
-- to leave open to everyone.
create policy "sales_delete_admin"
  on public.sales for delete
  to authenticated
  using (public.is_admin());
