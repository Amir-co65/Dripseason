import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import { useItemPostings, usePlatforms, useSetItemPosting } from "@/hooks/usePlatforms";
import { usePostingAccounts } from "@/hooks/useAccounts";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import type { PostingStatus } from "@/types/database.types";

export function PostingPage() {
  const { data: items = [], isLoading } = useInventoryItems({ status: "available", hasPackage: true });
  const { data: platforms = [] } = usePlatforms();
  const { data: postings = [] } = useItemPostings(items.map((item) => item.id));
  const { data: accounts = [] } = usePostingAccounts();
  const setPosting = useSetItemPosting();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const byItemPlatform = useMemo(() => new Map(postings.map((p) => [`${p.inventory_item_id}:${p.platform_slug}`, p])), [postings]);
  const needle = query.trim().toLowerCase();
  const rows = sortByPublicId(items.filter((item) => !needle || [item.item_name, item.legacy_public_id, item.sku, item.brand].some((value) => value?.toLowerCase().includes(needle))).filter((item) => !only || (byItemPlatform.get(`${item.id}:${only}`)?.status ?? "needs_posting") === "needs_posting"), (item) => item.legacy_public_id, sortOrder);
  const { data: thumbnails } = useItemThumbnails(rows.map((item) => item.id));
  function change(itemId: string, platform: string, value: string) {
    const status: PostingStatus = value === "needs_posting" || value === "skipped" ? value : "posted";
    setPosting.mutate({ inventory_item_id: itemId, platform_slug: platform, status, posting_account_id: status === "posted" ? value : null });
  }
  return <div className="flex flex-col gap-4"><PageHeader title="Posting" subtitle="Platform and account lists are managed from Accounts." />
    <div className="flex flex-wrap gap-2"><Input type="search" placeholder="Search name, ID, SKU, brand…" value={query} onChange={(e) => setQuery(e.target.value)} className="max-w-xs" /><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /><Select value={only} onChange={(e) => setOnly(e.target.value)} className="max-w-[200px]"><option value="">All items</option>{platforms.map((p) => <option key={p.slug} value={p.slug}>Needs {p.name}</option>)}</Select></div>
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !rows.length ? <EmptyState title="Nothing to post right now" /> : <TableScroll><thead><tr><Th>Item</Th>{platforms.map((p) => <Th key={p.slug}>{p.name}</Th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id}><Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name}/><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link><div className="text-xs text-neutral-400">{[item.legacy_public_id,item.sku].filter(Boolean).join(" · ")}</div></div></div></Td>{platforms.map((platform) => { const posting = byItemPlatform.get(`${item.id}:${platform.slug}`); const platformAccounts = accounts.filter((account) => account.platform === platform.slug); const value = posting?.status === "posted" && posting.posting_account_id ? posting.posting_account_id : posting?.status ?? "needs_posting"; return <Td key={platform.slug}><Select value={value} onChange={(e) => change(item.id, platform.slug, e.target.value)}><option value="needs_posting">X · to post</option><option value="skipped">– · skip</option>{platformAccounts.map((account) => <option key={account.id} value={account.id}>{account.account_number} · {account.display_name}</option>)}</Select></Td>; })}</tr>)}</tbody></TableScroll>}
  </div>;
}
