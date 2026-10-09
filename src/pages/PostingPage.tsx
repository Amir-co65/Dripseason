import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import { useItemPostings, useSetItemPosting } from "@/hooks/usePlatforms";
import { useMarketplaceAccounts, usePostingAccounts } from "@/hooks/useAccounts";
import { usePackages } from "@/hooks/useChapters";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import type { PostingStatus } from "@/types/database.types";

export function PostingPage() {
  const { data: items = [], isLoading } = useInventoryItems({ status: "available" });
  const { data: packages = [] } = usePackages();
  const { data: postings = [] } = useItemPostings(items.map((item) => item.id));
  const { data: postingAccounts = [] } = usePostingAccounts();
  const { data: marketplaceAccounts = [] } = useMarketplaceAccounts();
  const setPosting = useSetItemPosting();
  const [query, setQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const [isApplying, setIsApplying] = useState(false);

  const arrivingPackageIds = useMemo(() => new Set(packages.filter((pack) => pack.arrival_status === "arriving").map((pack) => pack.id)), [packages]);
  const availableItems = useMemo(() => items.filter((item) => !item.package_id || !arrivingPackageIds.has(item.package_id)), [items, arrivingPackageIds]);
  const byItemPlatform = useMemo(() => new Map(postings.map((posting) => [`${posting.inventory_item_id}:${posting.platform_slug}`, posting])), [postings]);
  const selectedAccount = postingAccounts.find((account) => account.id === selectedAccountId);
  const selectedMarketplaceAccount = selectedAccount && (selectedAccount.marketplace_account_id
    ? marketplaceAccounts.find((account) => account.id === selectedAccount.marketplace_account_id)
    : marketplaceAccounts.find((account) => account.platform === selectedAccount.platform && account.posting_account_number === selectedAccount.account_number));
  const needle = query.trim().toLowerCase();
  const searchMatches = useMemo(() => availableItems.filter((item) => !needle || [item.item_name, item.legacy_public_id, item.sku, item.brand].some((value) => value?.toLowerCase().includes(needle))), [availableItems, needle]);
  const accountItems = useMemo(() => !selectedAccount ? [] : sortByPublicId(searchMatches.filter((item) => {
    const posting = byItemPlatform.get(`${item.id}:${selectedAccount.platform}`);
    return posting?.status === "posted" && posting.posting_account_id === selectedAccount.id;
  }), (item) => item.legacy_public_id, sortOrder), [selectedAccount, searchMatches, byItemPlatform, sortOrder]);
  const { data: thumbnails } = useItemThumbnails(accountItems.map((item) => item.id));

  async function applyToMatches(status: PostingStatus) {
    if (!selectedAccount || !needle || !searchMatches.length) return;
    setIsApplying(true);
    try {
      await Promise.all(searchMatches.map((item) => setPosting.mutateAsync({ inventory_item_id: item.id, platform_slug: selectedAccount.platform, status, posting_account_id: status === "posted" ? selectedAccount.id : null })));
    } finally { setIsApplying(false); }
  }
  function change(itemId: string, status: PostingStatus) {
    if (!selectedAccount) return;
    setPosting.mutate({ inventory_item_id: itemId, platform_slug: selectedAccount.platform, status, posting_account_id: status === "posted" ? selectedAccount.id : null });
  }

  return <div className="flex flex-col gap-4">
    <PageHeader title="Posting" subtitle="Choose an account to see and manage the items posted on it." />
    {!postingAccounts.length ? <EmptyState title="No posting accounts yet" subtitle="Add an account from Accounts, then come back here to post items." /> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {postingAccounts.map((account) => {
          const postedCount = availableItems.filter((item) => { const posting = byItemPlatform.get(`${item.id}:${account.platform}`); return posting?.status === "posted" && posting.posting_account_id === account.id; }).length;
          const detail = account.marketplace_account_id ? marketplaceAccounts.find((candidate) => candidate.id === account.marketplace_account_id) : marketplaceAccounts.find((candidate) => candidate.platform === account.platform && candidate.posting_account_number === account.account_number);
          return <button key={account.id} onClick={() => setSelectedAccountId(account.id)} className={`rounded-xl border p-4 text-left transition ${selectedAccountId === account.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"}`}>
            <div className="font-semibold">{account.display_name}</div><div className={`text-sm ${selectedAccountId === account.id ? "text-neutral-300" : "text-neutral-500"}`}>{account.platform} · #{account.account_number}</div>
            {detail?.email && <div className={`mt-1 truncate text-xs ${selectedAccountId === account.id ? "text-neutral-300" : "text-neutral-400"}`}>{detail.email}</div>}<div className={`mt-3 text-sm ${selectedAccountId === account.id ? "text-white" : "text-neutral-700"}`}>{postedCount} posted item{postedCount === 1 ? "" : "s"}</div>
          </button>;
        })}
      </div>
      {selectedAccount && <>
        <div className="rounded-xl border border-neutral-200 bg-white p-4"><div className="mb-3"><div className="font-semibold">{selectedAccount.display_name}</div><div className="text-sm text-neutral-500">{selectedAccount.platform} account #{selectedAccount.account_number}{selectedMarketplaceAccount?.username ? ` · ${selectedMarketplaceAccount.username}` : ""}</div></div>
          <div className="flex flex-wrap gap-2"><Input type="search" placeholder="Search available products…" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-xs" /><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button variant="secondary" disabled={isApplying || !needle || !searchMatches.length} onClick={() => void applyToMatches("posted")}>Post all matches here</Button><Button variant="secondary" disabled={isApplying || !needle || !searchMatches.length} onClick={() => void applyToMatches("needs_posting")}>Mark all X</Button><Button variant="secondary" disabled={isApplying || !needle || !searchMatches.length} onClick={() => void applyToMatches("skipped")}>Mark all –</Button></div>
          {query.trim() && <p className="mt-2 text-xs text-neutral-500">These actions apply to all {searchMatches.length} available search match{searchMatches.length === 1 ? "" : "es"}. Items in arriving hauls are excluded.</p>}</div>
        {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !accountItems.length ? <EmptyState title="No posted items match this account" subtitle="Search products above and use “Post all matches here” to add them." /> : <TableScroll><thead><tr><Th>Posted item</Th><Th>Change status</Th></tr></thead><tbody>{accountItems.map((item) => <tr key={item.id}><Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name}/><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link><div className="text-xs text-neutral-400">{[item.legacy_public_id, item.sku].filter(Boolean).join(" · ")}</div></div></div></Td><Td><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => change(item.id, "needs_posting")}>X</Button><Button variant="ghost" onClick={() => change(item.id, "skipped")}>–</Button></div></Td></tr>)}</tbody></TableScroll>}</>}
    </>}
  </div>;
}
