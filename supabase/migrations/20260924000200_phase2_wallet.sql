-- ============================================================================
-- PHASE 2 - 0018: WALLET_BALANCES + WALLET_TRANSACTIONS
--
-- Maps from the original app's wallet.balances ({ cash, vinted, plick }).
--
-- ONE REAL IMPROVEMENT OVER THE OLD APP, WORTH FLAGGING:
-- The old app just directly overwrote a balance number whenever you
-- clicked "+Add" or "-Take" - there was no record of individual
-- adjustments, only the final total. wallet_transactions is new: every
-- deposit/withdrawal becomes its own permanent row (like a bank
-- statement), and a trigger keeps wallet_balances.balance as the running
-- total, calculated the same way your bank balance is - always equal to
-- the sum of every transaction. This is a genuine upgrade in
-- trustworthiness of the numbers, not just a rename.
-- ============================================================================

create table if not exists public.wallet_balances (
  bucket      text primary key check (bucket in ('cash', 'vinted', 'plick')),
  balance     numeric(10, 2) not null default 0,
  updated_at  timestamptz not null default now()
);

comment on table public.wallet_balances is 'Current balance per bucket. Always kept in sync with the sum of wallet_transactions by a trigger - never update this table directly.';

insert into public.wallet_balances (bucket, balance) values
  ('cash', 0), ('vinted', 0), ('plick', 0)
on conflict (bucket) do nothing;

create table if not exists public.wallet_transactions (
  id               uuid primary key default gen_random_uuid(),
  bucket           text not null check (bucket in ('cash', 'vinted', 'plick')),
  amount           numeric(10, 2) not null,   -- positive = deposit, negative = withdrawal
  reason           text,
  related_sale_id  uuid references public.sales (id) on delete set null,

  legacy_raw       jsonb,          -- the old app had no transaction log, only final balances - this stays
                                    -- null for anything imported from the old data; only new activity
                                    -- going forward will have real transaction rows.

  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

comment on table public.wallet_transactions is 'One row per deposit/withdrawal. Append-only, like activity_logs. Maps to nothing in the old data directly - see the note above.';

create index if not exists idx_wallet_transactions_bucket on public.wallet_transactions (bucket);
create index if not exists idx_wallet_transactions_created_at on public.wallet_transactions (created_at desc);

create or replace function public.apply_wallet_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallet_balances
     set balance = balance + new.amount,
         updated_at = now()
   where bucket = new.bucket;
  return new;
end;
$$;

create trigger trg_apply_wallet_transaction
  after insert on public.wallet_transactions
  for each row execute function public.apply_wallet_transaction();

alter table public.wallet_balances enable row level security;
alter table public.wallet_transactions enable row level security;

-- Wallet figures are financial/revenue information - matches the earlier
-- "workers see no income or revenue" rule (same assumption flagged in
-- migration 0014), so this is admin-only, full stop, both tables.
create policy "wallet_balances_select_admin"
  on public.wallet_balances for select
  to authenticated
  using (public.is_admin());

create policy "wallet_balances_update_admin"
  on public.wallet_balances for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "wallet_transactions_select_admin"
  on public.wallet_transactions for select
  to authenticated
  using (public.is_admin());

create policy "wallet_transactions_insert_admin"
  on public.wallet_transactions for insert
  to authenticated
  with check (public.is_admin());

-- No update/delete policy for wallet_transactions at all, on purpose -
-- same reasoning as activity_logs and sales: a financial record you can
-- silently edit after the fact isn't trustworthy as a record.
