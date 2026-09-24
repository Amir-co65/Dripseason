import { supabase } from "@/lib/supabase";
import type { Database, ArrivalStatus, InventoryStatus, PostingStatus } from "@/types/database.types";

/**
 * Imports a backup exported from the ORIGINAL single-file Project26 app
 * (the one with "backupType": "project26-full-backup") into this new
 * Supabase-backed schema. See PHASE2_DATA_MAPPING.md for the full field
 * mapping this code implements.
 *
 * Design notes:
 *  - We generate every new row's UUID ourselves (crypto.randomUUID())
 *    BEFORE inserting anything, and keep legacyId -> newId maps in memory.
 *    That means every foreign key can be resolved locally, without extra
 *    round-trips to look up "what id did that just get inserted as".
 *  - Rows are inserted in batches (chunked) rather than one at a time,
 *    except photos, which must be uploaded to Storage one file at a time -
 *    that part of a large import can take a while, which is normal.
 *  - Nothing here deletes existing data first. Running this twice against
 *    the same backup will create duplicates - it's meant to be run once,
 *    against an empty (freshly migrated) database.
 */

type Json = Record<string, any>;
export type ImportProgress = (message: string) => void;

export interface ImportSummary {
  chapters: number;
  packages: number;
  items: number;
  sales: number;
  photosUploaded: number;
  photosFailed: number;
  links: number;
  marketplaceAccounts: number;
  postingAccounts: number;
  closetSections: number;
  closetItemsPlaced: number;
  trades: number;
  warnings: string[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type InsertResult = { error: { message: string } | null };

/**
 * Large JSON imports need bounded request bodies. If a request is rejected or
 * times out, retry every row individually so a single bad record never stops
 * unrelated records from being preserved.
 */
async function insertInBatches<T>(options: {
  label: string;
  rows: T[];
  batchSize: number;
  insert: (rows: T[]) => Promise<InsertResult>;
  describe: (row: T) => string;
  warnings: string[];
  onProgress: ImportProgress;
}) {
  const batches = chunk(options.rows, options.batchSize);
  for (let index = 0; index < batches.length; index++) {
    const batch = batches[index];
    options.onProgress(`${options.label}: batch ${index + 1} of ${batches.length} (${Math.min((index + 1) * options.batchSize, options.rows.length)} of ${options.rows.length})...`);
    const { error } = await options.insert(batch);
    if (!error) continue;

    options.warnings.push(`${options.label} batch ${index + 1} failed (${error.message}). Retrying its ${batch.length} record(s) one at a time.`);
    for (const row of batch) {
      const { error: rowError } = await options.insert([row]);
      if (rowError) options.warnings.push(`${options.label} record ${options.describe(row)} could not be imported: ${rowError.message}`);
    }
  }
}

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:(.+?);base64,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const [, mime, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** PostgreSQL date columns reject empty and malformed strings. Preserve the
 * original value in sales.legacy_raw and use SQL NULL when it is not a real
 * calendar date; never discard the sale row. */
function legacySaleDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const datePart = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (value.trim().length > 10 && (value.trim()[10] !== "T" || Number.isNaN(Date.parse(value.trim())))) return null;
  return datePart;
}

export async function importLegacyBackup(backup: Json, onProgress: ImportProgress): Promise<ImportSummary> {
  const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
  const warnings: string[] = [];

  const chapterIdMap = new Map<string, string>(); // legacy chapter id -> new uuid
  const packageIdMap = new Map<string, string>();
  const itemIdMap = new Map<string, string>(); // legacy haul-item id -> new inventory_items.id
  const standaloneSaleItemIdMap = new Map<string, string>(); // old sold-sheet sale id -> new inventory item id
  const marketplaceAccountIdMap = new Map<string, string>();
  const postingAccountIdMap = new Map<string, string>(); // `${platform}:${number}` -> new uuid

  // -------------------------------------------------------------------
  // 1. CHAPTERS
  // -------------------------------------------------------------------
  onProgress("Importing chapters...");
  const chapterRows: Database["public"]["Tables"]["chapters"]["Insert"][] = [];
  for (const c of backup?.hauls?.chapters ?? []) {
    const id = crypto.randomUUID();
    chapterIdMap.set(c.id, id);
    chapterRows.push({
      id,
      name: c.name ?? "Untitled chapter",
      date_range: c.dateRange ?? null,
      chapter_number: typeof c.number === "number" ? c.number : null,
      legacy_id: c.id ?? null,
      legacy_raw: c,
      created_by: userId,
    });
  }
  await insertInBatches({ label: "Importing chapters", rows: chapterRows, batchSize: 100, insert: async (rows) => await supabase.from("chapters").insert(rows), describe: (row) => row.legacy_id ?? row.name, warnings, onProgress });

  // -------------------------------------------------------------------
  // 2. PACKAGES
  // -------------------------------------------------------------------
  onProgress("Importing packages...");
  const packageRows: Database["public"]["Tables"]["packages"]["Insert"][] = [];
  const allLegacyPackages: Json[] = [];
  for (const c of backup?.hauls?.chapters ?? []) {
    for (const p of c.packages ?? []) {
      allLegacyPackages.push(p);
      const chapterId = chapterIdMap.get(c.id);
      if (!chapterId) {
        warnings.push(`Package "${p.title}" skipped - its chapter wasn't found.`);
        continue;
      }
      const id = crypto.randomUUID();
      packageIdMap.set(p.id, id);
      const arrival: ArrivalStatus | null =
        p.arrivalStatus === "Arrived" ? "arrived" : p.arrivalStatus === "Arriving" ? "arriving" : null;
      const { items: _items, ...rawWithoutItems } = p;
      packageRows.push({
        id,
        chapter_id: chapterId,
        title: p.title ?? "Untitled package",
        package_number: typeof p.number === "number" ? p.number : null,
        package_date: p.date ?? null,
        info: p.info ?? null,
        shipping_cost: p.shippingCost ?? 0,
        shipping_code: p.shippingCode ?? null,
        arrival_status: arrival,
        legacy_id: p.id ?? null,
        legacy_raw: rawWithoutItems,
        created_by: userId,
      });
    }
  }
  await insertInBatches({ label: "Importing packages", rows: packageRows, batchSize: 75, insert: async (rows) => await supabase.from("packages").insert(rows), describe: (row) => row.legacy_id ?? row.title, warnings, onProgress });

  // -------------------------------------------------------------------
  // 3. INVENTORY ITEMS
  // -------------------------------------------------------------------
  onProgress("Importing inventory items...");
  const itemRows: Database["public"]["Tables"]["inventory_items"]["Insert"][] = [];
  // legacy_public_id is unique in the Phase 2 schema, but the original
  // Project26 backup can reuse a visible ID across different items. Keep the
  // first occurrence searchable in that column and preserve every duplicate
  // verbatim in legacy_raw; assigning a made-up ID would alter source data.
  const seenPublicIds = new Set<string>();
  const duplicatePublicIdCounts = new Map<string, number>();
  for (const p of allLegacyPackages) {
    const packageId = packageIdMap.get(p.id);
    for (const it of p.items ?? []) {
      const id = crypto.randomUUID();
      itemIdMap.set(it.id, id);
      const status: InventoryStatus = it.status === "Sold" ? "sold" : "available";
      const sourcePublicId = it.publicId == null || it.publicId === "" ? null : String(it.publicId);
      const legacyPublicId = sourcePublicId && seenPublicIds.has(sourcePublicId) ? null : sourcePublicId;
      if (sourcePublicId) {
        if (seenPublicIds.has(sourcePublicId)) {
          duplicatePublicIdCounts.set(sourcePublicId, (duplicatePublicIdCounts.get(sourcePublicId) ?? 1) + 1);
        } else {
          seenPublicIds.add(sourcePublicId);
        }
      }
      itemRows.push({
        id,
        item_name: it.name ?? "Untitled item",
        category: it.category ?? null,
        notes: it.notes ?? null,
        purchase_price: it.boughtFor ?? null,
        asking_price: it.sellFor ?? 0,
        sold_price: it.status === "Sold" ? it.soldFor ?? null : null,
        status,
        package_id: packageId ?? null,
        legacy_id: it.id ?? null,
        legacy_public_id: legacyPublicId,
        legacy_raw: it,
        created_by: userId,
      });
    }
  }
  if (duplicatePublicIdCounts.size) {
    const collisions = [...duplicatePublicIdCounts.entries()]
      .map(([publicId, count]) => `${publicId} (${count} records)`)
      .join(", ");
    warnings.push(
      `${duplicatePublicIdCounts.size} duplicate legacy public ID value(s) were found in the backup. The first occurrence keeps legacy_public_id; subsequent rows leave that unique column null while preserving the original ID in legacy_raw. Duplicates: ${collisions}`,
    );
  }
  // The original backup also contains sold-sheet rows that have no matching
  // haul item. They are real business records, so give each one a standalone
  // inventory row rather than dropping its sale because package_id is absent.
  for (const sale of backup?.sold?.items ?? []) {
    if (sale.sourceHaulItemId && itemIdMap.has(sale.sourceHaulItemId)) continue;
    const id = crypto.randomUUID();
    standaloneSaleItemIdMap.set(sale.id, id);
    if (sale.sourceHaulItemId) itemIdMap.set(sale.sourceHaulItemId, id);
    itemRows.push({
      id,
      item_name: sale.name ?? "Untitled sold item",
      category: sale.category ?? null,
      notes: sale.notes ?? null,
      purchase_price: sale.purchaseCost ?? null,
      asking_price: sale.sellingPrice ?? 0,
      sold_price: sale.sellingPrice ?? null,
      status: "sold",
      legacy_id: `sold-sheet:${sale.id}`,
      // A sold-sheet public ID can duplicate a haul ID. Preserve it in
      // legacy_raw and avoid breaking the database's unique visible-ID rule.
      legacy_public_id: null,
      legacy_raw: sale,
      created_by: userId,
    });
  }
  // Some media in the export has no matching haul row or sold-sheet row.
  // Create a standalone archived row for it so every photo/link survives.
  for (const entry of backup?.packageItemMedia ?? []) {
    if (itemIdMap.has(entry.itemId)) continue;
    const id = crypto.randomUUID();
    itemIdMap.set(entry.itemId, id);
    itemRows.push({
      id,
      item_name: `Legacy media item ${entry.itemId}`,
      asking_price: 0,
      status: "archived",
      legacy_id: `media-only:${entry.itemId}`,
      legacy_raw: entry,
      created_by: userId,
    });
  }
  await insertInBatches({ label: "Importing inventory items", rows: itemRows, batchSize: 50, insert: async (rows) => await supabase.from("inventory_items").insert(rows), describe: (row) => row.legacy_id ?? row.item_name, warnings, onProgress });

  // -------------------------------------------------------------------
  // 4. MARKETPLACE ACCOUNTS (imported before sales, so sales can
  //    optionally reference them - though we mainly keep the old label/
  //    number as text on the sale, per PHASE2_DATA_MAPPING.md)
  // -------------------------------------------------------------------
  onProgress("Importing marketplace accounts...");
  const accountRows: Database["public"]["Tables"]["marketplace_accounts"]["Insert"][] = [];
  for (const a of backup?.accounts?.accounts ?? []) {
    const id = crypto.randomUUID();
    marketplaceAccountIdMap.set(a.id, id);
    accountRows.push({
      id,
      platform: a.platform === "plick" ? "plick" : "vinted",
      label: a.label ?? "Untitled account",
      posting_account_number: a.postingAccountNumber ?? null,
      balance: a.balance ?? 0,
      email: a.email ?? null,
      username: a.username ?? null,
      password: a.password ?? null,
      phone: a.phone ?? null,
      notes: a.notes ?? null,
      banned: !!a.banned,
      legacy_id: a.id ?? null,
      legacy_raw: a,
      created_by: userId,
    });
  }
  await insertInBatches({ label: "Importing marketplace accounts", rows: accountRows, batchSize: 50, insert: async (rows) => await supabase.from("marketplace_accounts").insert(rows), describe: (row) => row.legacy_id ?? row.label, warnings, onProgress });

  // -------------------------------------------------------------------
  // 5. POSTING ACCOUNTS (the numbered registry) + per-item posting status
  // -------------------------------------------------------------------
  onProgress("Importing posting accounts...");
  const postingAccountRows: Database["public"]["Tables"]["posting_accounts"]["Insert"][] = [];
  for (const platform of ["vinted", "plick"] as const) {
    for (const entry of backup?.posting?.accounts?.[platform] ?? []) {
      const id = crypto.randomUUID();
      postingAccountIdMap.set(`${platform}:${entry.number}`, id);
      // Try to find a matching marketplace account with the same platform + number.
      const matched = accountRows.find((a) => a.platform === platform && a.posting_account_number === entry.number);
      postingAccountRows.push({
        id,
        platform,
        account_number: entry.number,
        display_name: entry.name ?? `Account #${entry.number}`,
        marketplace_account_id: matched?.id ?? null,
        legacy_raw: entry,
      });
    }
  }
  await insertInBatches({ label: "Importing posting accounts", rows: postingAccountRows, batchSize: 50, insert: async (rows) => await supabase.from("posting_accounts").insert(rows), describe: (row) => `${row.platform}:${row.account_number}`, warnings, onProgress });

  onProgress("Applying per-item posting status...");
  function resolvePostingStatus(raw: string | undefined): { status: PostingStatus; accountKey: string | null } {
    if (raw === "X" || raw === undefined) return { status: "needs_posting", accountKey: null };
    if (raw === "-") return { status: "skipped", accountKey: null };
    return { status: "posted", accountKey: raw }; // raw is the account number as a string
  }
  for (const postingItem of backup?.posting?.items ?? []) {
    const newItemId = itemIdMap.get(postingItem.sourceHaulItemId);
    if (!newItemId) continue;
    const vinted = resolvePostingStatus(postingItem.vinted);
    const plick = resolvePostingStatus(postingItem.plick);
    const { error } = await supabase
      .from("inventory_items")
      .update({
        vinted_posting_status: vinted.status,
        vinted_posting_account_id: vinted.accountKey ? postingAccountIdMap.get(`vinted:${vinted.accountKey}`) ?? null : null,
        plick_posting_status: plick.status,
        plick_posting_account_id: plick.accountKey ? postingAccountIdMap.get(`plick:${plick.accountKey}`) ?? null : null,
      })
      .eq("id", newItemId);
    if (error) warnings.push(`Could not set posting status for item ${postingItem.publicId ?? postingItem.sourceHaulItemId}: ${error.message}`);
  }

  // -------------------------------------------------------------------
  // 6. SALES (each insert also flips the linked item to 'sold' via trigger)
  // -------------------------------------------------------------------
  onProgress("Importing sales...");
  const saleRows: Database["public"]["Tables"]["sales"]["Insert"][] = [];
  let salesWithMissingDate = 0;
  let salesWithInvalidDate = 0;
  for (const s of backup?.sold?.items ?? []) {
    const inventoryItemId = s.sourceHaulItemId ? itemIdMap.get(s.sourceHaulItemId) : standaloneSaleItemIdMap.get(s.id);
    if (!inventoryItemId) {
      warnings.push(`Sale for "${s.name}" skipped - couldn't find its original item.`);
      continue;
    }
    const normalizedSaleDate = legacySaleDate(s.saleDate);
    if (s.saleDate == null || (typeof s.saleDate === "string" && !s.saleDate.trim())) salesWithMissingDate++;
    else if (normalizedSaleDate == null) salesWithInvalidDate++;
    // Sale photos are imported to Storage/item_media below. Do not also send
    // their base64 payload in every database row: it needlessly creates very
    // large requests and is the main source of statement timeouts.
    const { photos: _photos, ...saleRawWithoutPhotos } = s;
    saleRows.push({
      inventory_item_id: inventoryItemId,
      sold_price: s.sellingPrice ?? 0,
      sale_date: normalizedSaleDate,
      sale_platform: s.salePlace ?? null,
      buyer_note: s.buyerNote ?? null,
      legacy_id: s.id ?? null,
      legacy_source_chapter_name: s.sourceChapterName ?? null,
      legacy_source_package_title: s.sourcePackageTitle ?? null,
      legacy_sale_account_label: s.saleAccountLabel ?? null,
      legacy_sale_account_number: s.saleAccountNumber ?? null,
      legacy_raw: saleRawWithoutPhotos,
      created_by: userId,
    });
  }
  if (salesWithMissingDate || salesWithInvalidDate) {
    warnings.push(
      `${salesWithMissingDate} sale(s) had empty/null dates and ${salesWithInvalidDate} had invalid dates. All sale records were imported with sale_date set to NULL; the original date values remain preserved in each sale's legacy_raw data.`,
    );
  }
  await insertInBatches({ label: "Importing sales", rows: saleRows, batchSize: 25, insert: async (rows) => await supabase.from("sales").insert(rows), describe: (row) => row.legacy_id ?? row.inventory_item_id, warnings, onProgress });

  // -------------------------------------------------------------------
  // 7. PHOTOS + LINKS (packageItemMedia[], plus sold.items[].photos[])
  //    This is the slow part - one network call per photo.
  // -------------------------------------------------------------------
  onProgress("Uploading photos and links...");
  let photosUploaded = 0;
  let photosFailed = 0;
  let linksImported = 0;

  const mediaEntries: Json[] = backup?.packageItemMedia ?? [];
  let processed = 0;
  for (const entry of mediaEntries) {
    const inventoryItemId = itemIdMap.get(entry.itemId);
    if (!inventoryItemId) continue;

    let position = 0;
    for (const photoDataUrl of entry.photos ?? []) {
      processed++;
      if (processed % 10 === 0) onProgress(`Uploading photos... (${processed} processed so far)`);
      const file = dataUrlToFile(photoDataUrl, `photo-${position}.jpg`);
      if (!file) {
        photosFailed++;
        continue;
      }
      try {
        const path = `${inventoryItemId}/${Date.now()}-${position}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage.from("item-photos").upload(path, file);
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase
          .from("item_media")
          .insert({ inventory_item_id: inventoryItemId, kind: "photo", storage_path: path, position });
        if (insertError) throw insertError;
        photosUploaded++;
      } catch (err) {
        photosFailed++;
        warnings.push(`A photo for item failed to import: ${err instanceof Error ? err.message : String(err)}`);
      }
      position++;
    }

    const { photos: _photos, ...mediaRawWithoutPhotos } = entry;
    for (const link of entry.links ?? []) {
      const { error } = await supabase
        .from("item_media")
        .insert({ inventory_item_id: inventoryItemId, kind: "link", external_url: link, legacy_raw: mediaRawWithoutPhotos });
      if (!error) linksImported++;
    }
  }

  // The Sold sheet owns its own photo list.  These photos are not always
  // duplicated in packageItemMedia, so import them separately and retain the
  // source ordering after the package-level images.
  for (const sale of backup?.sold?.items ?? []) {
    const inventoryItemId = sale.sourceHaulItemId
      ? itemIdMap.get(sale.sourceHaulItemId)
      : standaloneSaleItemIdMap.get(sale.id);
    if (!inventoryItemId) continue;

    let position = 1000;
    for (const photoDataUrl of sale.photos ?? []) {
      processed++;
      if (processed % 10 === 0) onProgress(`Uploading photos... (${processed} processed so far)`);
      const file = dataUrlToFile(photoDataUrl, `sold-photo-${position}.jpg`);
      if (!file) {
        photosFailed++;
        position++;
        continue;
      }
      try {
        const path = `${inventoryItemId}/${Date.now()}-${position}-${Math.random().toString(36).slice(2)}.jpg`;
        const { error: uploadError } = await supabase.storage.from("item-photos").upload(path, file);
        if (uploadError) throw uploadError;
        const { error: insertError } = await supabase
          .from("item_media")
          .insert({ inventory_item_id: inventoryItemId, kind: "photo", storage_path: path, position, legacy_raw: sale });
        if (insertError) throw insertError;
        photosUploaded++;
      } catch (err) {
        photosFailed++;
        warnings.push(`A sold-sheet photo failed to import: ${err instanceof Error ? err.message : String(err)}`);
      }
      position++;
    }
  }

  // -------------------------------------------------------------------
  // 8. WALLET - each old starting balance becomes one transaction, so the
  //    trigger applies it and the history stays meaningful from day one.
  // -------------------------------------------------------------------
  onProgress("Importing wallet balances...");
  const walletBuckets = ["cash", "vinted", "plick"] as const;
  for (const bucket of walletBuckets) {
    const amount = backup?.wallet?.balances?.[bucket] ?? 0;
    if (!amount) continue;
    const { error } = await supabase
      .from("wallet_transactions")
      .insert({ bucket, amount, reason: "Imported starting balance from legacy backup", created_by: userId });
    if (error) warnings.push(`Could not import ${bucket} wallet balance: ${error.message}`);
  }

  // -------------------------------------------------------------------
  // 9. CLOSET
  // -------------------------------------------------------------------
  onProgress("Importing closet sections...");
  let closetItemsPlaced = 0;
  for (const section of backup?.closet?.sections ?? []) {
    const sectionId = crypto.randomUUID();
    const { error } = await supabase.from("closet_sections").insert({
      id: sectionId,
      name: section.name ?? "Untitled section",
      legacy_id: section.id ?? null,
      legacy_raw: section,
      created_by: userId,
    });
    if (error) {
      warnings.push(`Closet section "${section.name}" failed to import: ${error.message}`);
      continue;
    }
    for (const legacyItemId of section.itemIds ?? []) {
      const inventoryItemId = itemIdMap.get(legacyItemId);
      if (!inventoryItemId) continue;
      const { error: placeError } = await supabase
        .from("closet_items")
        .insert({ closet_section_id: sectionId, inventory_item_id: inventoryItemId });
      if (!placeError) closetItemsPlaced++;
    }
  }

  // -------------------------------------------------------------------
  // 10. TRADES
  // -------------------------------------------------------------------
  onProgress("Importing trades...");
  const tradeRows: Database["public"]["Tables"]["trades"]["Insert"][] = [];
  for (const t of backup?.trades?.trades ?? []) {
    const selected = (t.selectedItemIds ?? []).map((i: string) => itemIdMap.get(i)).filter(Boolean) as string[];
    const sold = (t.soldItemIds ?? []).map((i: string) => itemIdMap.get(i)).filter(Boolean) as string[];
    const active = t.activeItemId ? itemIdMap.get(t.activeItemId) ?? null : null;
    tradeRows.push({
      trade_date: t.date ?? null,
      received_name: t.receivedName ?? "Untitled trade",
      kind: t.kind === "return-exchange" ? "return-exchange" : "standard-trade",
      notes: t.notes ?? null,
      selected_item_ids: selected,
      sold_item_ids: sold,
      active_item_id: active,
      legacy_id: t.id ?? null,
      legacy_raw: t,
      created_by: userId,
    });
  }
  await insertInBatches({ label: "Importing trades", rows: tradeRows, batchSize: 50, insert: async (rows) => await supabase.from("trades").insert(rows), describe: (row) => row.legacy_id ?? row.received_name, warnings, onProgress });

  onProgress("Done.");

  return {
    chapters: chapterRows.length,
    packages: packageRows.length,
    items: itemRows.length,
    sales: saleRows.length,
    photosUploaded,
    photosFailed,
    links: linksImported,
    marketplaceAccounts: accountRows.length,
    postingAccounts: postingAccountRows.length,
    closetSections: (backup?.closet?.sections ?? []).length,
    closetItemsPlaced,
    trades: tradeRows.length,
    warnings,
  };
}
