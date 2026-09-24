import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { useChapters, usePackages } from "@/hooks/useChapters";
import { useInventoryItems, useUpdateInventoryItem } from "@/hooks/useInventory";
import { useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { usePostingAccounts } from "@/hooks/useAccounts";
import type { PostingStatus } from "@/types/database.types";

export function PostingPage() {
  const { data: items = [], isLoading } = useInventoryItems({ status: "available", hasPackage: true });
  const { data: packages = [] } = usePackages();
  const { data: chapters = [] } = useChapters();
  const { data: vintedAccounts } = usePostingAccounts("vinted");
  const { data: plickAccounts } = usePostingAccounts("plick");
  const update = useUpdateInventoryItem();
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<"" | "vinted" | "plick">("");
  const [page, setPage] = useState(0);
  const packageById = useMemo(() => new Map(packages.map((item) => [item.id, item])), [packages]);
  const chapterById = useMemo(() => new Map(chapters.map((item) => [item.id, item])), [chapters]);
  const eligibleItems = items.filter((item) => {
    const pack = item.package_id ? packageById.get(item.package_id) : null;
    return Boolean(pack) && pack?.arrival_status !== "arriving";
  });
  const rows = eligibleItems.filter((item) => {
    const needle = query.trim().toLowerCase();
    if (needle && !item.item_name.toLowerCase().includes(needle) && !(item.legacy_public_id ?? "").toLowerCase().includes(needle)) return false;
    return !only || (only === "vinted" ? item.vinted_posting_status === "needs_posting" : item.plick_posting_status === "needs_posting");
  });
  const vintedPending = eligibleItems.filter((item) => item.vinted_posting_status === "needs_posting").length;
  const plickPending = eligibleItems.filter((item) => item.plick_posting_status === "needs_posting").length;
  const pageSize = 60;
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const { data: thumbnails } = useItemThumbnails(visibleRows.map((item) => item.id));

  function optionsFor(list: typeof vintedAccounts, currentAccountId: string | null) {
    const options = [{ value: "needs_posting", label: "X · to post" }, { value: "skipped", label: "– · skip" }, ...(list ?? []).map((account) => ({ value: account.id, label: `${account.account_number} · ${account.display_name}` }))];
    if (currentAccountId && !options.some((option) => option.value === currentAccountId)) options.push({ value: currentAccountId, label: "Current account" });
    return options;
  }
  function valueFor(status: PostingStatus, accountId: string | null) { return status === "posted" && accountId ? accountId : status; }
  function change(itemId: string, platform: "vinted" | "plick", value: string) {
    const input = value === "needs_posting" || value === "skipped"
      ? platform === "vinted" ? { vinted_posting_status: value as PostingStatus, vinted_posting_account_id: null } : { plick_posting_status: value as PostingStatus, plick_posting_account_id: null }
      : platform === "vinted" ? { vinted_posting_status: "posted" as const, vinted_posting_account_id: value } : { plick_posting_status: "posted" as const, plick_posting_account_id: value };
    update.mutate({ id: itemId, input });
  }

  return <div className="flex flex-col gap-4"><PageHeader title="Posting" subtitle={`Track which account each item is posted on · ${vintedPending} still to post on Vinted, ${plickPending} on Plick`} />
    <div className="flex flex-wrap gap-2"><Input type="search" placeholder="Search name or ID…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="max-w-xs" /><Select value={only} onChange={(e) => { setOnly(e.target.value as "" | "vinted" | "plick"); setPage(0); }} className="max-w-[200px]"><option value="">All items</option><option value="vinted">Needs Vinted</option><option value="plick">Needs Plick</option></Select></div>
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !rows.length ? <EmptyState title="Nothing to post right now" /> : <TableScroll><thead><tr><Th>Item</Th><Th>Package</Th><Th>Vinted</Th><Th>Plick</Th></tr></thead><tbody>{visibleRows.map((item) => { const pack = item.package_id ? packageById.get(item.package_id) : null; const chapter = pack ? chapterById.get(pack.chapter_id) : null; return <tr key={item.id}><Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name} /><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link>{item.legacy_public_id && <div className="text-xs text-neutral-400">{item.legacy_public_id}</div>}</div></div></Td><Td>{pack ? <>{pack.title}{chapter && <span className="text-neutral-400"> · {chapter.name}</span>}</> : "—"}</Td><Td><Select value={valueFor(item.vinted_posting_status, item.vinted_posting_account_id)} onChange={(e) => change(item.id, "vinted", e.target.value)}>{optionsFor(vintedAccounts, item.vinted_posting_account_id).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Td><Td><Select value={valueFor(item.plick_posting_status, item.plick_posting_account_id)} onChange={(e) => change(item.id, "plick", e.target.value)}>{optionsFor(plickAccounts, item.plick_posting_account_id).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Td></tr>; })}</tbody></TableScroll>}
    {rows.length > pageSize && <div className="flex items-center justify-end gap-3 text-sm"><span className="text-neutral-500">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}
    <section className="rounded-xl border border-neutral-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">Posting accounts</h2><div className="grid gap-4 sm:grid-cols-2"><AccountList title="Vinted" accounts={vintedAccounts ?? []} /><AccountList title="Plick" accounts={plickAccounts ?? []} /></div><p className="mt-3 text-xs text-neutral-500">Add or rename accounts in the Accounts page.</p></section>
  </div>;
}
function AccountList({ title, accounts }: { title: string; accounts: { id: string; account_number: number; display_name: string }[] }) { return <div><div className="mb-1 text-sm text-neutral-500">{title}</div>{accounts.length ? accounts.map((account) => <div key={account.id} className="flex justify-between border-b border-neutral-100 py-1 text-sm"><span>{account.account_number}</span><span>{account.display_name}</span></div>) : <span className="text-sm text-neutral-400">—</span>}</div>; }
