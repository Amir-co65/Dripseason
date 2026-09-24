-- ============================================================================
-- PHASE 2 - 0012: ITEM_MEDIA
--
-- Maps from the original app's packageItemMedia[]. Your old data actually
-- stores TWO different kinds of media per item: real photos (base64 image
-- data, in the old single-file app) and plain external links (e.g. a
-- supplier's 1688.com product page URL). This table keeps both, using
-- "kind" to tell them apart:
--   - kind = 'photo' -> storage_path points into Supabase Storage (see the
--     storage bucket migration). Importing old data means re-uploading
--     each base64 photo as a real file and recording its path here.
--   - kind = 'link'  -> external_url holds the original link as-is, no
--     re-upload needed.
-- ============================================================================

create table if not exists public.item_media (
  id                  uuid primary key default gen_random_uuid(),
  inventory_item_id   uuid not null references public.inventory_items (id) on delete cascade,

  kind                text not null default 'photo' check (kind in ('photo', 'link')),
  storage_path        text,             -- required when kind = 'photo': the file's path inside the Storage bucket
  external_url        text,             -- required when kind = 'link': a plain external URL, e.g. a supplier page

  position            integer not null default 0,  -- display order among an item's photos

  legacy_raw          jsonb,            -- original packageItemMedia entry this came from, if imported

  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),

  constraint item_media_kind_fields_match check (
    (kind = 'photo' and storage_path is not null and external_url is null) or
    (kind = 'link'  and external_url is not null and storage_path is null)
  )
);

comment on table public.item_media is 'Photos (in Supabase Storage) and external links per inventory item. Maps from the original packageItemMedia[].';

create index if not exists idx_item_media_inventory_item_id on public.item_media (inventory_item_id);

alter table public.item_media enable row level security;

create policy "item_media_select_authenticated"
  on public.item_media for select
  to authenticated
  using (true);

-- Workers need this: "upload photos" is explicitly one of their allowed
-- actions.
create policy "item_media_insert_authenticated"
  on public.item_media for insert
  to authenticated
  with check (true);

create policy "item_media_delete_authenticated"
  on public.item_media for delete
  to authenticated
  using (true);
