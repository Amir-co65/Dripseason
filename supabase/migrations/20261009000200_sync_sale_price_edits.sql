-- Keep the inventory item's summary price in sync when a recorded sale is edited.
create or replace function public.sync_inventory_price_on_sale_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sold_price is distinct from old.sold_price then
    update public.inventory_items
       set sold_price = new.sold_price
     where id = new.inventory_item_id and status = 'sold';
  end if;
  return new;
end $$;

drop trigger if exists trg_sync_inventory_price_on_sale_update on public.sales;
create trigger trg_sync_inventory_price_on_sale_update
  after update of sold_price on public.sales
  for each row execute function public.sync_inventory_price_on_sale_update();
