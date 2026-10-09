import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import { useItemPostings, usePlatforms, useSetItemPosting, useSetItemPostingsBulk } from "@/hooks/usePlatforms";
import { useMarketplaceAccounts, usePostingAccounts } from "@/hooks/useAccounts";
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
  const { data: postingAccounts = [] } = usePostingAccounts();
  const { data: marketplaceAccounts = [] } = useMarketplaceAccounts();
  const setPosting = useSetItemPosting();
  const setBulkPosting = useSetItemPostingsBulk();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState("");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const [isApplying, setIsApplying] = useState(false);
  const [bulkPlatform, setBulkPlatform] = useState("");
  const [bulkAction, setBulkAction] = useState("needs_posting");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [openedAccountId, setOpenedAccountId] = useState<string | null>(null);

  const arrivedPackageIds = useMemo(() => new Set(packages.filter((pack) => pack.arrival_status === "arrived").map((pack) => pack.id)), [packages]);
  const items = useMemo(() => inventory.filter((item) => !!item.package_id && arrivedPackageIds.has(item.package_id)), [inventory, arrivedPackageIds]);
  const byItemPlatform = useMemo(() => new Map(postings.map((posting) => [`${posting.inventory_item_id}:${posting.platform_slug}`, posting])), [postings]);
  const isBanned = (account: (typeof postingAccounts)[number]) => marketplaceAccounts.some((marketplace) => marketplace.banned && (account.marketplace_account_id ? marketplace.id === account.marketplace_account_id : marketplace.platform === account.platform && marketplace.posting_account_number === account.account_number));
  const accounts = postingAccounts.filter((account) => !isBanned(account));
  const needle = query.trim().toLowerCase();
  const matchingItems = items.filter((item) => !needle || [item.item_name, item.legacy_public_id, item.sku, item.brand].some((value) => value?.toLowerCase().includes(needle)));
  const rows = sortByPublicId(matchingItems.filter((item) => !only || (byItemPlatform.get(`${item.id}:${only}`)?.status ?? "needs_posting") === "needs_posting"), (item) => item.legacy_public_id, sortOrder);
  const { data: thumbnails } = useItemThumbnails(rows.map((item) => item.id));
  const bulkPlatformAccounts = accounts.filter((account) => account.platform === bulkPlatform);
  const openedAccount = accounts.find((account) => account.id === openedAccountId);
  const openedAccountItems = openedAccount ? sortByPublicId(items.filter((item) => {
    const posting = byItemPlatform.get(`${item.id}:${openedAccount.platform}`);
    return posting?.status === "posted" && posting.posting_account_id === openedAccount.id;
  }), (item) => item.legacy_public_id, sortOrder) : [];
  const { data: accountThumbnails } = useItemThumbnails(openedAccountItems.map((item) => item.id));

  function change(itemId: string, platform: string, value: string) {
    const status: PostingStatus = value === "needs_posting" || value === "skipped" ? value : "posted";
    setPosting.mutate({ inventory_item_id: itemId, platform_slug: platform, status, posting_account_id: status === "posted" ? value : null });
  }
  async function applyBulkAction() {
    if (!needle || !matchingItems.length || !bulkPlatform) return;
    const selectedAccount = bulkPlatformAccounts.find((account) => account.id === bulkAction);
    const status: PostingStatus = selectedAccount ? "posted" : bulkAction as PostingStatus;
    setIsApplying(true);
    try {
      await setBulkPosting.mutateAsync({ inventory_item_ids: matchingItems.map((item) => item.id), platform_slug: bulkPlatform, status, posting_account_id: selectedAccount?.id ?? null });
    } finally { setIsApplying(false); }
  }

  return <div className="flex flex-col gap-4"><PageHeader title="Posting" subtitle="Available, unsold items from arrived packages." />
    <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={() => setAccountsOpen(true)}>Accounts & posted items</Button><Input type="search" placeholder="Search name, ID, SKU, brand…" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-xs" /><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /><Select value={only} onChange={(event) => setOnly(event.target.value)} className="max-w-[200px]"><option value="">All items</option>{platforms.map((platform) => <option key={platform.slug} value={platform.slug}>Needs {platform.name}</option>)}</Select></div>
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-white p-3"><span className="text-sm font-medium">Apply to search results:</span><Select aria-label="Platform for bulk posting action" value={bulkPlatform} onChange={(event) => { setBulkPlatform(event.target.value); setBulkAction("needs_posting"); }} className="max-w-[180px]"><option value="">Choose platform…</option>{platforms.map((platform) => <option key={platform.slug} value={platform.slug}>{platform.name}</option>)}</Select><Select aria-label="Bulk posting status" value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className="max-w-[220px]"><option value="needs_posting">X · to post</option><option value="skipped">– · skip</option>{bulkPlatformAccounts.map((account) => <option key={account.id} value={account.id}>#{account.account_number} · {account.display_name}</option>)}</Select><Button disabled={isApplying || !needle || !bulkPlatform || !matchingItems.length} onClick={() => void applyBulkAction()}>{isApplying ? "Applying…" : `Apply to ${matchingItems.length} matches`}</Button>{!needle && <span className="text-xs text-neutral-500">Type a search first.</span>}</div>
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !rows.length ? <EmptyState title="Nothing to post right now" subtitle="Only unsold available items in arrived packages appear here." /> : <TableScroll><thead><tr><Th>Item</Th>{platforms.map((platform) => <Th key={platform.slug}>{platform.name}</Th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id}><Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name}/><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link><div className="text-xs text-neutral-400">{[item.legacy_public_id, item.sku].filter(Boolean).join(" · ")}</div></div></div></Td>{platforms.map((platform) => { const posting = byItemPlatform.get(`${item.id}:${platform.slug}`); const platformAccounts = accounts.filter((account) => account.platform === platform.slug); const value = posting?.status === "posted" && posting.posting_account_id ? posting.posting_account_id : posting?.status ?? "needs_posting"; return <Td key={platform.slug}><Select value={value} onChange={(event) => change(item.id, platform.slug, event.target.value)}><option value="needs_posting">X · to post</option><option value="skipped">– · skip</option>{platformAccounts.map((account) => <option key={account.id} value={account.id}>#{account.account_number} · {account.display_name}</option>)}</Select></Td>; })}</tr>)}</tbody></TableScroll>}
    {accountsOpen && <Modal open onClose={() => { setAccountsOpen(false); setOpenedAccountId(null); }} title="Accounts and posted items" wide><div className="grid gap-4 md:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.4fr)]"><div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">{accounts.map((account) => <button key={account.id} onClick={() => setOpenedAccountId(account.id)} className={`rounded-lg border p-3 text-left ${openedAccountId === account.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:bg-neutral-50"}`}><div className="font-medium">{account.display_name}</div><div className="text-xs capitalize">{account.platform} · #{account.account_number}</div></button>)}{accounts.length === 0 && <p className="text-sm text-neutral-500">No active posting accounts. Manage them from Accounts.</p>}</div><div className="max-h-[60vh] overflow-y-auto rounded-lg border border-neutral-200 p-3">{!openedAccount ? <p className="text-sm text-neutral-500">Open an account to see its posted items.</p> : <><h3 className="mb-2 font-semibold">{openedAccount.display_name} · {openedAccount.platform} #{openedAccount.account_number}</h3>{openedAccountItems.length ? openedAccountItems.map((item) => <div key={item.id} className="flex items-center gap-2 border-b border-neutral-100 py-2 last:border-0"><ItemThumbnail src={accountThumbnails?.get(item.id)} name={item.item_name} /><Link to={`/inventory/${item.id}`} className="text-sm font-medium hover:underline">{item.legacy_public_id ? `${item.legacy_public_id} · ` : ""}{item.item_name}</Link></div>) : <p className="text-sm text-neutral-500">No available items are marked as posted to this account.</p>}</>}</div></div></Modal>}
  </div>;
}
