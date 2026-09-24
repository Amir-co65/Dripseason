-- ============================================================================
-- PHASE 2 - 0020: TRADES
--
-- Maps from the original app's trades.trades[].
--
-- A NOTE ON THE ITEM LISTS: the old data links a trade to several items
-- via arrays of item IDs (selectedItemIds, soldItemIds). A fully
-- "relational" design would put these in their own join table (like
-- closet_items above) - but you only listed "trades" as a table to build,
-- not a separate join table, so instead these stay as array columns
-- directly on trades, keeping the shape close to the original and the
-- table count matching what you asked for. The trade-off: Postgres can't
-- enforce "every ID in this array is a real inventory item" as a foreign
-- key the way it can for a normal column - that integrity check would
-- need to happen in application code instead. Tell me if you'd rather
-- have a proper trade_items join table instead; it's a quick change.
-- ============================================================================

create table if not exists public.trades (
  id                  uuid primary key default gen_random_uuid(),
  trade_date          date,
  received_name       text not null,          -- what came IN as part of this trade
  kind                text not null default 'standard-trade'
                         check (kind in ('standard-trade', 'return-exchange')),
  notes               text,

  selected_item_ids   uuid[] not null default '{}',   -- items given up in the trade
  sold_item_ids       uuid[] not null default '{}',   -- of those, which were later sold
  active_item_id      uuid,                            -- the currently "in focus" item, if any

  legacy_id           text unique,
  legacy_raw          jsonb,

  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.trades is 'A trade or return/exchange. Maps from trades.trades[]. See the note above about why item references are arrays here rather than a join table.';

create index if not exists idx_trades_trade_date on public.trades (trade_date desc);
-- Lets you efficiently ask "which trades involve item X" despite the array shape.
create index if not exists idx_trades_selected_item_ids on public.trades using gin (selected_item_ids);

create trigger trg_trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

alter table public.trades enable row level security;

create policy "trades_select_authenticated"
  on public.trades for select to authenticated using (true);
create policy "trades_insert_authenticated"
  on public.trades for insert to authenticated with check (true);
create policy "trades_update_authenticated"
  on public.trades for update to authenticated using (true) with check (true);
create policy "trades_delete_admin"
  on public.trades for delete to authenticated using (public.is_admin());
