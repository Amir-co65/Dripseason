import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type MediaInsert = Database["public"]["Tables"]["item_media"]["Insert"];

const BUCKET = "item-photos";

export async function listItemMedia(inventoryItemId: string) {
  const { data, error } = await supabase
    .from("item_media")
    .select("*")
    .eq("inventory_item_id", inventoryItemId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

/** Fetch only the first photo reference for each listed item. The image files
 * themselves are requested lazily by the browser from the public Storage URL. */
export async function listItemThumbnailUrls(inventoryItemIds: string[]) {
  const uniqueIds = [...new Set(inventoryItemIds)];
  const thumbnails = new Map<string, string>();
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const idBatch = uniqueIds.slice(offset, offset + 100);
    const { data, error } = await supabase
      .from("item_media")
      .select("inventory_item_id, storage_path, position")
      .eq("kind", "photo")
      .in("inventory_item_id", idBatch)
      .order("position", { ascending: true });
    if (error) throw error;
    for (const media of data ?? []) {
      if (media.storage_path && !thumbnails.has(media.inventory_item_id)) {
        thumbnails.set(media.inventory_item_id, getPhotoUrl(media.storage_path));
      }
    }
  }
  return thumbnails;
}

/** Returns a permanent public URL for a stored photo (the bucket is
 * public - see migration 0015 for why). */
export function getPhotoUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

/** Uploads one photo file for an item and records it in item_media. */
export async function uploadItemPhoto(inventoryItemId: string, file: File, position = 0) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${inventoryItemId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const insert: MediaInsert = {
    inventory_item_id: inventoryItemId,
    kind: "photo",
    storage_path: path,
    position,
  };
  const { data, error } = await supabase.from("item_media").insert(insert).select().single();
  if (error) throw error;
  return data;
}

export async function addItemLink(inventoryItemId: string, url: string) {
  const insert: MediaInsert = { inventory_item_id: inventoryItemId, kind: "link", external_url: url };
  const { data, error } = await supabase.from("item_media").insert(insert).select().single();
  if (error) throw error;
  return data;
}

/** Removes a media row AND, for photos, the underlying file in Storage. */
export async function deleteItemMedia(mediaId: string, storagePath?: string | null) {
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([storagePath]);
    // Non-fatal: if the file's already gone, still remove the database row.
    if (storageError) console.warn("Could not remove storage file:", storageError.message);
  }
  const { error } = await supabase.from("item_media").delete().eq("id", mediaId);
  if (error) throw error;
}
