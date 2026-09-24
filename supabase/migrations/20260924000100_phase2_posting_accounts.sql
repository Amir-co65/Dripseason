-- ============================================================================
-- PHASE 2 - 0017: POSTING_ACCOUNTS + PER-ITEM POSTING STATUS
--
-- A NOTE ON HOW I'VE INTERPRETED THIS TABLE, since the original data had
-- two related-but-different things both called "posting accounts":
--
-- 1. posting.accounts.vinted[] / .plick[] in your old JSON - a short,
--    numbered list ("account #4 is dripseason.new") used purely so the
--    Posting page could show a dropdown. This is what "posting_accounts"
--    below actually is: a lightweight, numbered registry per platform,
--    optionally linked to the full credentials in marketplace_accounts
--    when known.
--
-- 2. posting.items[] in your old JSON - for EACH item, its Vinted status
--    ('X' = needs posting, '-' = skip, or a number = posted under that
--    account) and separately its Plick status. That's not really a
--    standalone "accounts" table at all - it's a status flag per item, so
--    I've added it as four new columns directly on inventory_items
--    instead (two platforms x [status, which account]), matching the
--    original shape closely rather than inventing an unlisted table.
-- ============================================================================

create table if not exists public.posting_accounts (
  id                      uuid primary key default gen_random_uuid(),
  platform                text not null check (platform in ('vinted', 'plick')),
  account_number          integer not null,
  display_name            text not null,
  marketplace_account_id  uuid references public.marketplace_accounts (id) on delete set null,

  legacy_raw              jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (platform, account_number)
);

comment on table public.posting_accounts is 'The numbered account list used on the Posting page, e.g. "Vinted #4 = dripseason.new". Maps from posting.accounts.vinted[]/plick[]. Optionally linked to the full credential record in marketplace_accounts.';

create trigger trg_posting_accounts_set_updated_at
  before update on public.posting_accounts
  for each row execute function public.set_updated_at();

alter table public.posting_accounts enable row level security;

create policy "posting_accounts_select_authenticated"
  on public.posting_accounts for select
  to authenticated
  using (true);

create policy "posting_accounts_insert_authenticated"
  on public.posting_accounts for insert
  to authenticated
  with check (true);

create policy "posting_accounts_update_authenticated"
  on public.posting_accounts for update
  to authenticated
  using (true)
  with check (true);

create policy "posting_accounts_delete_admin"
  on public.posting_accounts for delete
  to authenticated
  using (public.is_admin());

-- --- per-item posting status (see the note above) ---

alter table public.inventory_items
  add column if not exists vinted_posting_status text not null default 'needs_posting'
    check (vinted_posting_status in ('needs_posting', 'skipped', 'posted')),
  add column if not exists vinted_posting_account_id uuid references public.posting_accounts (id) on delete set null,
  add column if not exists plick_posting_status text not null default 'needs_posting'
    check (plick_posting_status in ('needs_posting', 'skipped', 'posted')),
  add column if not exists plick_posting_account_id uuid references public.posting_accounts (id) on delete set null;

comment on column public.inventory_items.vinted_posting_status is 'Old posting.items[].vinted: ''X''->''needs_posting'', ''-''->''skipped'', a number-> ''posted'' (with vinted_posting_account_id set to the matching posting_accounts row).';
comment on column public.inventory_items.plick_posting_status is 'Same idea as vinted_posting_status, for Plick.';

create index if not exists idx_inventory_items_vinted_status on public.inventory_items (vinted_posting_status);
create index if not exists idx_inventory_items_plick_status on public.inventory_items (plick_posting_status);

-- inventory_items_secure (migration 0014) was built with an explicit column
-- list, so it doesn't automatically pick up the four new columns just
-- added above. CREATE OR REPLACE VIEW can only ever APPEND new output
-- columns at the end (it can't reorder or remove existing ones), which is
-- exactly what we want here - every existing column stays in the exact
-- same place, so nothing that already depends on this view breaks.
create or replace view public.inventory_items_secure
with (security_invoker = true)
as
select
  id,
  sku,
  item_name,
  brand,
  category,
  size,
  color,
  description,
  notes,
  case when public.is_admin() then purchase_price else null end as purchase_price,
  asking_price,
  case when public.is_admin() then sold_price else null end as sold_price,
  status,
  package_id,
  closet_location,
  legacy_id,
  legacy_public_id,
  created_by,
  created_at,
  updated_at,
  vinted_posting_status,
  vinted_posting_account_id,
  plick_posting_status,
  plick_posting_account_id
from public.inventory_items;
