-- Project26 parity: database-owned workflow rules.  The UI may be replaced,
-- but sales, returns, posting accounts and undo remain consistent.

create table if not exists public.platforms (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
insert into public.platforms (slug, name) values
 ('vinted','Vinted'), ('plick','Plick'), ('ebay','Ebay'), ('depop','Depop'),
 ('facebook-marketplace','Facebook Marketplace'), ('instagram','Instagram')
on conflict (slug) do nothing;
alter table public.marketplace_accounts drop constraint if exists marketplace_accounts_platform_check;
alter table public.posting_accounts drop constraint if exists posting_accounts_platform_check;
alter table public.platforms enable row level security;
drop policy if exists "platforms_read" on public.platforms;
create policy "platforms_read" on public.platforms for select to authenticated using (true);
drop policy if exists "platforms_manage_admin" on public.platforms;
create policy "platforms_manage_admin" on public.platforms for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Generic per-platform posting replaces the two historical fixed columns.
create table if not exists public.item_postings (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  platform_slug text not null references public.platforms(slug),
  status text not null default 'needs_posting' check (status in ('needs_posting','skipped','posted')),
  posting_account_id uuid references public.posting_accounts(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(inventory_item_id, platform_slug)
);
create index if not exists idx_item_postings_lookup on public.item_postings(platform_slug, status, inventory_item_id);
drop trigger if exists trg_item_postings_updated on public.item_postings;
create trigger trg_item_postings_updated before update on public.item_postings for each row execute function public.set_updated_at();
alter table public.item_postings enable row level security;
drop policy if exists "item_postings_read" on public.item_postings;
create policy "item_postings_read" on public.item_postings for select to authenticated using (true);
drop policy if exists "item_postings_write" on public.item_postings;
create policy "item_postings_write" on public.item_postings for all to authenticated using (true) with check (true);

insert into public.item_postings (inventory_item_id, platform_slug, status, posting_account_id)
select id, 'vinted', vinted_posting_status, vinted_posting_account_id from public.inventory_items
on conflict (inventory_item_id, platform_slug) do nothing;
insert into public.item_postings (inventory_item_id, platform_slug, status, posting_account_id)
select id, 'plick', plick_posting_status, plick_posting_account_id from public.inventory_items
on conflict (inventory_item_id, platform_slug) do nothing;

alter table public.marketplace_accounts add column if not exists account_owner_id uuid references public.profiles(id) on delete set null;
alter table public.marketplace_accounts alter column created_by set default auth.uid();
alter table public.chapters add column if not exists period_start date;
create unique index if not exists idx_chapters_period_start on public.chapters(period_start) where period_start is not null;
alter table public.inventory_items add column if not exists deleted_at timestamptz;
create or replace view public.inventory_items_secure
with (security_invoker = true)
as select id, sku, item_name, brand, category, size, color, description, notes,
 case when public.is_admin() then purchase_price else null end as purchase_price,
 asking_price, case when public.is_admin() then sold_price else null end as sold_price,
 status, package_id, closet_location, legacy_id, legacy_public_id, created_by, created_at, updated_at,
 vinted_posting_status, vinted_posting_account_id, plick_posting_status, plick_posting_account_id
from public.inventory_items where deleted_at is null;

-- Workers manage accounts, but only credentials belonging to accounts they created/own.
drop policy if exists "marketplace_accounts_insert_admin" on public.marketplace_accounts;
drop policy if exists "marketplace_accounts_update_admin" on public.marketplace_accounts;
drop policy if exists "marketplace_accounts_delete_admin" on public.marketplace_accounts;
drop policy if exists "marketplace_accounts_insert_authenticated" on public.marketplace_accounts;
drop policy if exists "marketplace_accounts_update_owner_or_admin" on public.marketplace_accounts;
drop policy if exists "marketplace_accounts_delete_owner_or_admin" on public.marketplace_accounts;
create policy "marketplace_accounts_insert_authenticated" on public.marketplace_accounts for insert to authenticated with check (created_by = auth.uid() or created_by is null);
create policy "marketplace_accounts_update_owner_or_admin" on public.marketplace_accounts for update to authenticated using (public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid()) with check (public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid());
create policy "marketplace_accounts_delete_owner_or_admin" on public.marketplace_accounts for delete to authenticated using (public.is_admin() or created_by = auth.uid());
drop policy if exists "chapters_update_authenticated" on public.chapters;
drop policy if exists "chapters_update_admin" on public.chapters;
create policy "chapters_update_admin" on public.chapters for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- Do not grant raw credential-column reads to workers. The view runs with its
-- owner's column permissions and explicitly decides what each caller sees.
revoke select (email, username, password, phone) on public.marketplace_accounts from authenticated;
create or replace view public.marketplace_accounts_secure with (security_invoker = false) as
select id, platform, label, posting_account_number, balance,
 case when public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid() then email else null end as email,
 case when public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid() then username else null end as username,
 case when public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid() then password else null end as password,
 case when public.is_admin() or created_by = auth.uid() or account_owner_id = auth.uid() then phone else null end as phone,
 notes, banned, legacy_id, created_by, created_at, updated_at, account_owner_id
from public.marketplace_accounts;

-- Derive the sale account from the item's posting record whenever possible.
create or replace function public.resolve_sale_account()
returns trigger language plpgsql security definer set search_path = public as $$
declare resolved_account uuid; resolved_platform text;
begin
  if new.marketplace_account_id is null and new.sale_platform is not null then
    select ma.id into resolved_account
    from public.item_postings ip join public.posting_accounts pa on pa.id = ip.posting_account_id
      left join public.marketplace_accounts ma on ma.id = pa.marketplace_account_id
    where ip.inventory_item_id = new.inventory_item_id and ip.platform_slug = lower(new.sale_platform)
      and ip.status = 'posted' limit 1;
    new.marketplace_account_id := resolved_account;
  end if;
  if new.marketplace_account_id is not null then
    select platform into resolved_platform from public.marketplace_accounts where id = new.marketplace_account_id;
    if resolved_platform is not null then new.sale_platform := resolved_platform; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_resolve_sale_account on public.sales;
create trigger trg_resolve_sale_account before insert or update of marketplace_account_id,sale_platform,inventory_item_id on public.sales for each row execute function public.resolve_sale_account();

-- Every sale change creates the matching account/wallet delta.  This keeps
-- edits, unsells and return/exchange reversals balanced as well.
create or replace function public.settle_sale_money()
returns trigger language plpgsql security definer set search_path = public as $$
declare old_amount numeric := 0; new_amount numeric := 0; old_account uuid; new_account uuid; old_bucket text; new_bucket text;
begin
  if tg_op <> 'INSERT' then old_amount := old.sold_price; old_account := old.marketplace_account_id; old_bucket := lower(coalesce(old.sale_platform,'cash')); end if;
  if tg_op <> 'DELETE' then new_amount := new.sold_price; new_account := new.marketplace_account_id; new_bucket := lower(coalesce(new.sale_platform,'cash')); end if;
  -- Account updates below have their own trigger that mirrors the exact delta
  -- to wallet history.  Direct wallet entries are only for cash/unlinked sales.
  if old_account is not null then update public.marketplace_accounts set balance = balance - old_amount where id = old_account;
  elsif old_amount <> 0 then insert into public.wallet_transactions(bucket, amount, reason, related_sale_id) values (case when old_bucket = 'cash' then 'cash' else old_bucket end, -old_amount, 'Sale reversal', old.id); end if;
  if new_account is not null then update public.marketplace_accounts set balance = balance + new_amount where id = new_account;
  elsif new_amount <> 0 then insert into public.wallet_transactions(bucket, amount, reason, related_sale_id) values (case when new_bucket = 'cash' then 'cash' else new_bucket end, new_amount, 'Sale', new.id); end if;
  return coalesce(new,old);
end $$;
-- Wallet buckets must be able to hold dynamic marketplace money.
alter table public.wallet_balances drop constraint if exists wallet_balances_bucket_check;
alter table public.wallet_transactions drop constraint if exists wallet_transactions_bucket_check;
create or replace function public.ensure_wallet_bucket() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.wallet_balances(bucket,balance) values(new.bucket,0) on conflict do nothing; return new; end $$;
drop trigger if exists trg_ensure_wallet_bucket on public.wallet_transactions;
create trigger trg_ensure_wallet_bucket before insert on public.wallet_transactions for each row execute function public.ensure_wallet_bucket();
drop trigger if exists trg_settle_sale_money on public.sales;
create trigger trg_settle_sale_money after insert or update or delete on public.sales for each row execute function public.settle_sale_money();

create or replace function public.mirror_account_balance_to_wallet()
returns trigger language plpgsql security definer set search_path = public as $$
declare delta numeric;
begin
  delta := new.balance - old.balance;
  if delta <> 0 then
    insert into public.wallet_transactions(bucket, amount, reason)
    values(new.platform, delta, 'Account balance adjustment · ' || new.label);
  end if;
  return new;
end $$;
drop trigger if exists trg_mirror_account_balance_to_wallet on public.marketplace_accounts;
create trigger trg_mirror_account_balance_to_wallet after update of balance on public.marketplace_accounts for each row execute function public.mirror_account_balance_to_wallet();

create or replace function public.return_sale(p_sale_id uuid, p_received_name text, p_date date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare t_id uuid; s public.sales;
begin
 select * into s from public.sales where id = p_sale_id for update;
 if not found then raise exception 'Sale not found'; end if;
 insert into public.trades(received_name,kind,trade_date,selected_item_ids,sold_item_ids,active_item_id)
 values(p_received_name,'return-exchange',p_date,array[s.inventory_item_id],array[s.inventory_item_id],s.inventory_item_id) returning id into t_id;
 delete from public.sales where id = p_sale_id;
 return t_id;
end $$;
grant execute on function public.return_sale(uuid,text,date) to authenticated;

-- Recent user-facing actions are reversible. Derived money rows are never
-- restored independently; reversing their sale lets the accounting triggers do it.
create table if not exists public.undo_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
 table_name text not null, operation text not null check(operation in('INSERT','UPDATE','DELETE')),
 row_before jsonb, row_after jsonb, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '24 hours', undone_at timestamptz
);
alter table public.undo_events enable row level security;
drop policy if exists "undo_own" on public.undo_events;
create policy "undo_own" on public.undo_events for select to authenticated using(user_id=auth.uid());
create or replace function public.capture_undo() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if current_setting('project26.undo_replay',true) = 'on' then return coalesce(new,old); end if;
 insert into public.undo_events(user_id,table_name,operation,row_before,row_after)
 values(auth.uid(),tg_table_name,tg_op,case when tg_op <> 'INSERT' then to_jsonb(old) end,case when tg_op <> 'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
-- The business rows listed here cover item/package/account/trade and sale actions.
drop trigger if exists trg_undo_inventory_items on public.inventory_items; create trigger trg_undo_inventory_items after insert or update on public.inventory_items for each row execute function public.capture_undo();
drop trigger if exists trg_undo_packages on public.packages; create trigger trg_undo_packages after insert or update or delete on public.packages for each row execute function public.capture_undo();
drop trigger if exists trg_undo_marketplace_accounts on public.marketplace_accounts; create trigger trg_undo_marketplace_accounts after insert or update or delete on public.marketplace_accounts for each row execute function public.capture_undo();
drop trigger if exists trg_undo_sales on public.sales; create trigger trg_undo_sales after insert or update or delete on public.sales for each row execute function public.capture_undo();
drop trigger if exists trg_undo_trades on public.trades; create trigger trg_undo_trades after insert or update or delete on public.trades for each row execute function public.capture_undo();
drop trigger if exists trg_undo_closet_items on public.closet_items; create trigger trg_undo_closet_items after insert or delete on public.closet_items for each row execute function public.capture_undo();
create or replace function public.undo_latest_action() returns text language plpgsql security definer set search_path=public as $$
declare e public.undo_events; target uuid;
begin
 select * into e from public.undo_events where user_id=auth.uid() and undone_at is null and expires_at>now() order by created_at desc limit 1 for update;
 if not found then raise exception 'Nothing to undo'; end if;
 perform set_config('project26.undo_replay','on',true);
 target := coalesce((e.row_after->>'id')::uuid,(e.row_before->>'id')::uuid);
 if e.operation='INSERT' then execute format('delete from public.%I where id=$1',e.table_name) using target;
 elsif e.operation='DELETE' then execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',e.table_name,e.table_name) using e.row_before;
 else execute format('update public.%I set (id)=(id) where id=$1',e.table_name) using target; -- replaced below per row
   execute format('update public.%I set %s where id=$1',e.table_name, (select string_agg(format('%I = (jsonb_populate_record(null::public.%I,$2)).%I',column_name,e.table_name,column_name),', ') from information_schema.columns where table_schema='public' and table_name=e.table_name and column_name <> 'id')) using target,e.row_before;
 end if;
 update public.undo_events set undone_at=now() where id=e.id;
 return e.table_name || ' ' || lower(e.operation);
end $$;
grant execute on function public.undo_latest_action() to authenticated;

-- Ownership choices intentionally expose no email or credentials.
create or replace function public.account_owners()
returns table(id uuid, full_name text) language sql security definer set search_path=public as $$
  select p.id, coalesce(p.full_name, 'Worker') from public.profiles p
  where p.is_active and (p.role = 'worker' or public.is_admin()) order by 2;
$$;
grant execute on function public.account_owners() to authenticated;

create or replace function public.ensure_monthly_chapter(p_now date default current_date) returns public.chapters language plpgsql security definer set search_path=public as $$
declare start_date date := (date_trunc('month',p_now)::date + 20); result public.chapters;
begin
 if p_now < start_date then start_date := (date_trunc('month',p_now - interval '1 month')::date + 20); end if;
 insert into public.chapters(name,chapter_number,period_start,date_range)
 select 'Chapter ' || coalesce(max(chapter_number),0)+1, coalesce(max(chapter_number),0)+1, start_date, to_char(start_date,'DD.MM.YYYY') || ' – '
 from public.chapters where not exists(select 1 from public.chapters c where c.period_start=start_date)
 returning * into result;
 if result.id is null then select * into result from public.chapters where period_start=start_date; end if;
 return result;
end $$;
grant execute on function public.ensure_monthly_chapter(date) to authenticated;

-- Supabase's pg_cron runs independently of the browser. The function's
-- unique period_start index makes a retry or catch-up invocation harmless.
create extension if not exists pg_cron;
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'project26-monthly-chapter') then
    perform cron.schedule('project26-monthly-chapter', '5 0 21 * *', 'select public.ensure_monthly_chapter(current_date);');
  end if;
end $$;

create or replace function public.delete_chapter_safely(p_chapter_id uuid, p_move_packages_to uuid default null)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Admin only'; end if;
 if exists(select 1 from public.packages where chapter_id=p_chapter_id) and p_move_packages_to is null then raise exception 'Choose a chapter for the packages before deleting'; end if;
 if p_move_packages_to=p_chapter_id then raise exception 'Choose a different chapter'; end if;
 if p_move_packages_to is not null then update public.packages set chapter_id=p_move_packages_to where chapter_id=p_chapter_id; end if;
 delete from public.chapters where id=p_chapter_id;
 update public.chapters c set chapter_number=n.n from (select id,row_number() over(order by coalesce(period_start,created_at),id)::int n from public.chapters) n where c.id=n.id;
end $$;
grant execute on function public.delete_chapter_safely(uuid,uuid) to authenticated;
