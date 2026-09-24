-- ============================================================================
-- PHASE 2 - 0014: MONEY-MASKING VIEWS FOR WORKERS
--
-- ASSUMPTION I'M CARRYING FORWARD - PLEASE CONFIRM:
-- Earlier in this project, the rule was "workers see no income/revenue
-- info at all". Today's instructions only say workers "cannot view
-- sensitive business credentials" and don't explicitly repeat the
-- no-money rule - so I've assumed it still applies and built it in. If
-- that's changed for Phase 2, tell me and this migration can be dropped
-- (the base tables and everything else are unaffected either way).
--
-- HOW THE MASKING ACTUALLY WORKS, AND WHY IT'S A VIEW AND NOT JUST AN
-- APP-LEVEL CHECK:
-- Supabase gives every logged-in person the SAME underlying Postgres role
-- ("authenticated") no matter whether they're an admin or a worker in
-- your profiles table - the role distinction is just a column of data,
-- not a different database login. That means plain column permissions
-- (REVOKE SELECT ON some_column) can't tell a worker and an admin apart,
-- since to Postgres they're the same database user.
--
-- The fix: a VIEW that replaces sensitive columns with null unless
-- is_admin() is true, evaluated fresh on every single query using the
-- viewer's own session - so a worker querying this view never receives
-- the real numbers in the response at all, regardless of what the
-- frontend does or doesn't display. Real security lives here, in the
-- database - same principle as the admin code from Phase 1.
--
-- THE APP SHOULD QUERY THESE VIEWS FOR DISPLAY, not the raw tables, so
-- this masking actually takes effect. Raw-table access is still needed
-- for INSERT/UPDATE (e.g. a worker recording a sale price), which these
-- views don't affect - they only change what SELECT returns.
-- ============================================================================

create view public.inventory_items_secure
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
  asking_price,   -- NOT masked: workers need to know the asking price to actually sell the item
  case when public.is_admin() then sold_price else null end as sold_price,
  status,
  package_id,
  closet_location,
  legacy_id,
  legacy_public_id,
  created_by,
  created_at,
  updated_at
from public.inventory_items;

comment on view public.inventory_items_secure is 'Same as inventory_items, but purchase_price and sold_price read as null for non-admins. asking_price is intentionally visible to everyone - it''s the price a worker needs to actually sell the item.';

create view public.sales_secure
with (security_invoker = true)
as
select
  id,
  inventory_item_id,
  case when public.is_admin() then sold_price else null end as sold_price,
  sale_date,
  sale_platform,
  buyer_note,
  marketplace_account_id,
  legacy_id,
  created_by,
  created_at,
  updated_at
from public.sales;

comment on view public.sales_secure is 'Same as sales, but sold_price reads as null for non-admins.';

-- security_invoker = true (set above) makes each view run with the
-- CALLING user's own permissions and RLS, rather than the view creator's -
-- required so the views stay just as row-secure as the base tables, and
-- so is_admin() correctly checks whoever is actually running the query.
grant select on public.inventory_items_secure to authenticated;
grant select on public.sales_secure to authenticated;
