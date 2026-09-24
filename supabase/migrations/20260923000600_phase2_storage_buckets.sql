-- ============================================================================
-- PHASE 2 - 0015: STORAGE BUCKET FOR ITEM PHOTOS
--
-- Supabase Storage is itself just a Postgres table (storage.objects) under
-- the hood, protected by the exact same kind of RLS policies we've been
-- writing all along - so this should look familiar.
--
-- Bucket choice: PUBLIC. Product photos for resale listings aren't
-- sensitive information (unlike account passwords or prices) - they're
-- effectively public marketing images already, since they get posted on
-- Vinted/Plick anyway. Making the bucket public means the app can use a
-- simple, permanent public URL for each photo instead of generating
-- short-lived signed URLs everywhere. If you'd rather keep photos private
-- (e.g. requiring login to view any photo), tell me and this can be
-- switched to a private bucket with signed URLs instead - it's a small
-- change, better to decide it now than migrate photos later.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

-- Anyone logged in can view photos via the authenticated API path.
-- (On top of this, since the bucket is public, anyone with a direct photo
-- URL can also view it without logging in at all - that's what "public"
-- bucket means. This policy just covers the authenticated/API access path.)
create policy "item_photos_select_authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'item-photos');

-- "Workers can upload photos" - explicitly one of their allowed actions.
create policy "item_photos_insert_authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'item-photos');

-- Anyone logged in can remove a photo (e.g. replacing a blurry shot) -
-- matching how the original app worked, where removing a photo from an
-- item's gallery wasn't an admin-only action. Tell me if you'd rather
-- restrict deletes to admins only, same as inventory item deletion.
create policy "item_photos_delete_authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'item-photos');

-- ----------------------------------------------------------------------------
-- Suggested file path convention (enforced by your app code, not the
-- database): store each file at
--     item-photos/{inventory_item_id}/{random-filename}.jpg
-- so photos for one item are grouped in their own "folder" and item_media
-- .storage_path holds that full path, e.g.
-- "a1b2c3-.../photo-1700000000.jpg". This isn't required by the policies
-- above, it's just the recommended pattern for the upload code we'll
-- write in the next phase.
-- ----------------------------------------------------------------------------
