-- Allocate a new legacy public ID inside the INSERT transaction.  The old
-- client-side allocation only received one PostgREST page of existing IDs,
-- so it could choose an ID that already existed once inventory exceeded that
-- page size.  The advisory lock also makes concurrent inserts safe.
create or replace function public.assign_inventory_legacy_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
begin
  if new.legacy_public_id is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.inventory_items.legacy_public_id'));

  select coalesce(max((substring(legacy_public_id from '^([0-9]+)b0$'))::integer), 0) + 1
    into next_number
  from public.inventory_items;

  new.legacy_public_id := lpad(next_number::text, 3, '0') || 'b0';
  return new;
end;
$$;

drop trigger if exists trg_assign_inventory_legacy_public_id on public.inventory_items;
create trigger trg_assign_inventory_legacy_public_id
  before insert on public.inventory_items
  for each row execute function public.assign_inventory_legacy_public_id();
