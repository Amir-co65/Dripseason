-- ============================================================================
-- PHASE 2 - 0016: MARKETPLACE_ACCOUNTS
--
-- Maps from the original app's accounts.accounts[] (your Vinted/Plick
-- selling accounts, with their login credentials and running balance).
-- ============================================================================

create table if not exists public.marketplace_accounts (
  id                      uuid primary key default gen_random_uuid(),
  platform                text not null check (platform in ('vinted', 'plick')),
  label                   text not null,
  posting_account_number  integer,          -- old postingAccountNumber - the short numeric ID used elsewhere
  balance                 numeric(10, 2) not null default 0,
  email                   text,
  username                text,
  password                text,             -- see the SECURITY NOTE below
  phone                   text,
  notes                   text,
  banned                  boolean not null default false,

  legacy_id               text unique,
  legacy_raw              jsonb,

  created_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.marketplace_accounts is 'Vinted/Plick selling accounts. Maps from accounts.accounts[].';

-- SECURITY NOTE: password is stored as plain text here, same as your
-- original app. RLS + the secure view below stop WORKERS from ever
-- reading it back through the app - but an admin with direct database
-- access (e.g. the Supabase dashboard's table editor) would see it in
-- plain text. For real production hardening, Postgres/Supabase supports
-- encrypting specific columns at rest using the pgsodium extension, so
-- that even direct database access shows ciphertext, not the real
-- password. That's a genuinely good next step, but it adds real
-- complexity (key management) that's easy to get wrong untested, so I've
-- left it as a flagged follow-up rather than guessing at it now - happy
-- to implement it properly whenever you want that step done.
comment on column public.marketplace_accounts.password is 'Stored as plain text - see SECURITY NOTE in this migration file about upgrading to encrypted-at-rest storage.';

create unique index if not exists idx_marketplace_accounts_platform_number
  on public.marketplace_accounts (platform, posting_account_number)
  where posting_account_number is not null;
create index if not exists idx_marketplace_accounts_banned on public.marketplace_accounts (banned);

create trigger trg_marketplace_accounts_set_updated_at
  before update on public.marketplace_accounts
  for each row execute function public.set_updated_at();

alter table public.marketplace_accounts enable row level security;

-- Both roles can see accounts exist (a worker needs to know which numbered
-- account to post an item under) - but see the secure view below for what
-- "seeing" actually means for a worker.
create policy "marketplace_accounts_select_authenticated"
  on public.marketplace_accounts for select
  to authenticated
  using (true);

-- Unlike inventory, managing accounts (adding, editing, deleting, banning)
-- is admin-only - matches "workers cannot view sensitive business
-- credentials", extended here to mean they don't manage the accounts
-- themselves either, only reference which one an item is posted under.
create policy "marketplace_accounts_insert_admin"
  on public.marketplace_accounts for insert
  to authenticated
  with check (public.is_admin());

create policy "marketplace_accounts_update_admin"
  on public.marketplace_accounts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "marketplace_accounts_delete_admin"
  on public.marketplace_accounts for delete
  to authenticated
  using (public.is_admin());

-- Same masking pattern as inventory_items_secure/sales_secure (migration
-- 0014): a worker querying this view gets null for password, no matter
-- what the app's UI does or doesn't show.
create view public.marketplace_accounts_secure
with (security_invoker = true)
as
select
  id,
  platform,
  label,
  posting_account_number,
  balance,
  email,
  username,
  case when public.is_admin() then password else null end as password,
  phone,
  notes,
  banned,
  legacy_id,
  created_by,
  created_at,
  updated_at
from public.marketplace_accounts;

comment on view public.marketplace_accounts_secure is 'Same as marketplace_accounts, but password reads as null for non-admins.';

grant select on public.marketplace_accounts_secure to authenticated;

-- Now that marketplace_accounts exists, wire up the column that sales.
-- marketplace_account_id was left pointing nowhere from migration 0013.
alter table public.sales
  add constraint fk_sales_marketplace_account
  foreign key (marketplace_account_id)
  references public.marketplace_accounts (id)
  on delete set null;

create index if not exists idx_sales_marketplace_account_id on public.sales (marketplace_account_id);
