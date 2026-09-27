-- Continue the Project26 public ID sequence: 000a0 ... 999a0, then
-- 000b0 ... 999b0, continuing through 000z0 ... 999z0.
-- Keep allocation in the insert transaction so concurrent creates stay unique.
create or replace function public.assign_inventory_legacy_public_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  letter_number integer;
begin
  if new.legacy_public_id is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.inventory_items.legacy_public_id'));

  select coalesce(max(
    (ascii(lower(m.captures[2])) - ascii('a')) * 1000 + m.captures[1]::integer
  ), -1) + 1
    into next_number
  from public.inventory_items item
  cross join lateral regexp_match(item.legacy_public_id, '^([0-9]{3})([a-z])0$', 'i') as m(captures);

  letter_number := next_number / 1000;
  if letter_number > 25 then
    raise exception 'Inventory public ID sequence exhausted';
  end if;

  new.legacy_public_id := lpad((next_number % 1000)::text, 3, '0')
    || chr(ascii('a') + letter_number) || '0';
  return new;
end;
$$;

drop trigger if exists trg_assign_inventory_legacy_public_id on public.inventory_items;
create trigger trg_assign_inventory_legacy_public_id
  before insert on public.inventory_items
  for each row execute function public.assign_inventory_legacy_public_id();
