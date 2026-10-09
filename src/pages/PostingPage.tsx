import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import { useItemPostings, usePlatforms, useSetItemPosting } from "@/hooks/usePlatforms";
import { usePostingAccounts } from "@/hooks/useAccounts";
import { usePackages } from "@/hooks/useChapters";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import type { PostingStatus } from "@/types/database.types";

export function PostingPage() {
  const { data: inventory = [], isLoading } = useInventoryItems({ status: "available", hasPackage: true });
  const { data: packages = [] } = usePackages();
  const { data: platforms = [] } = usePlatforms();
  const { data: postings = [] } = useItemPostings(inventory.map((item) => item.id));
  const { data: accounts = [] } = usePostingAccounts();
  const setPosting = useSetItemPosting();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const [isApplying, setIsApplying] = useState(false);
  const arrivedPackageIds = useMemo(() => new Set(packages.filter((pack) => pack.arrival_status === "arrived").map((pack) => pack.id)), [packages]);
  const items = useMemo(() => inventory.filter((item) => !!item.package_id && arrivedPackageIds.has(item.package_id)), [inventory, arrivedPackageIds]);
  const byItemPlatform = useMemo(() => new Map(postings.map((posting) => [`${posting.inventory_item_id}:${posting.platform_slug}`, posting])), [postings]);
  const needle = query.trim().toLowerCase();
  const matchingItems = items.filter((item) => !needle || [item.item_name, item.legacy_public_id, item.sku, item.brand].some((value) => value?.toLowerCase().includes(needle)));
  const rows = sortByPublicId(matchingItems.filter((item) => !only || (byItemPlatform.get(`${item.id}:${only}`)?.status ?? "needs_posting") === "needs_posting"), (item) => item.legacy_public_id, sortOrder);
  const { data: thumbnails } = useItemThumbnails(rows.map((item) => item.id));

  function change(itemId: string, platform: string, value: string) {
    const status: PostingStatus = value === "needs_posting" || value === "skipped" ? value : "posted";
    setPosting.mutate({ inventory_item_id: itemId, platform_slug: platform, status, posting_account_id: status === "posted" ? value : null });
  }
  async function markAll(platform: string, status: PostingStatus) {
    if (!needle || !matchingItems.length) return;
    setIsApplying(true);
    try {
      await Promise.all(matchingItems.map((item) => setPosting.mutateAsync({ inventory_item_id: item.id, platform_slug: platform, status, posting_account_id: null })));
    } finally { setIsApplying(false); }
  }

  return <div className="flex flex-col gap-4"><PageHeader title="Posting" subtitle="Available, unsold items from arrived packages." />
    <div className="flex flex-wrap gap-2"><Input type="search" placeholder="Search name, ID, SKU, brand…" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-xs" /><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /><Select value={only} onChange={(event) => setOnly(event.target.value)} className="max-w-[200px]"><option value="">All items</option>{platforms.map((platform) => <option key={platform.slug} value={platform.slug}>Needs {platform.name}</option>)}</Select></div>
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !rows.length ? <EmptyState title="Nothing to post right now" subtitle="Only unsold available items in arrived packages appear here." /> : <TableScroll><thead><tr><Th>Item</Th>{platforms.map((platform) => <Th key={platform.slug}><div>{platform.name}</div>{needle && <div className="mt-1 flex gap-1"><Button variant="ghost" className="px-2 py-1 text-xs" disabled={isApplying || !matchingItems.length} onClick={() => void markAll(platform.slug, "needs_posting")}>Mark all X</Button><Button variant="ghost" className="px-2 py-1 text-xs" disabled={isApplying || !matchingItems.length} onClick={() => void markAll(platform.slug, "skipped")}>Mark all –</Button></div>}</Th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id}><Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name}/><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link><div className="text-xs text-neutral-400">{[item.legacy_public_id, item.sku].filter(Boolean).join(" · ")}</div></div></div></Td>{platforms.map((platform) => { const posting = byItemPlatform.get(`${item.id}:${platform.slug}`); const platformAccounts = accounts.filter((account) => account.platform === platform.slug); const value = posting?.status === "posted" && posting.posting_account_id ? posting.posting_account_id : posting?.status ?? "needs_posting"; return <Td key={platform.slug}><Select value={value} onChange={(event) => change(item.id, platform.slug, event.target.value)}><option value="needs_posting">X · to post</option><option value="skipped">– · skip</option>{platformAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_number} · {account.display_name}</option>)}</Select></Td>; })}</tr>)}</tbody></TableScroll>}
  </div>;
}
