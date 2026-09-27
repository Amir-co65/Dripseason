import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { TableScroll, Td, Th } from "@/components/ui/Table";
import { useAuth } from "@/context/AuthContext";
import { useChapters, usePackages } from "@/hooks/useChapters";
import { useInventoryItems } from "@/hooks/useInventory";
import { useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { RecordItemSaleForm } from "@/pages/InventoryItemPage";
import { ItemTextScanner } from "@/components/inventory/ItemTextScanner";
import { formatMoney } from "@/lib/format";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import type { Database } from "@/types/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];

export function AvailablePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: items = [], isLoading } = useInventoryItems({ status: "available", hasPackage: true });
  const { data: packages = [] } = usePackages();
  const { data: chapters = [] } = useChapters();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const [page, setPage] = useState(0);
  const [selling, setSelling] = useState<Item | null>(null);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const packageById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);
  const chapterById = useMemo(() => new Map(chapters.map((c) => [c.id, c])), [chapters]);
  const eligibleItems = items.filter((item) => {
    const pack = item.package_id ? packageById.get(item.package_id) : null;
    return Boolean(pack) && pack?.arrival_status !== "arriving";
  });
  const filteredRows = eligibleItems.filter((item) => {
    const pack = item.package_id ? packageById.get(item.package_id) : null;
    if (category && item.category !== category) return false;
    if (chapterId && pack?.chapter_id !== chapterId) return false;
    const needle = query.trim().toLocaleLowerCase();
    const matchesSearch = !needle || item.item_name.toLocaleLowerCase().includes(needle) || (item.legacy_public_id ?? "").toLocaleLowerCase().includes(needle);
    const matchesScan = !scannedCodes.length || scannedCodes.some((code) => [item.legacy_public_id, item.sku].some((value) => value?.toUpperCase() === code));
    return matchesSearch && matchesScan;
  });
  const rows = sortByPublicId(filteredRows, (item) => item.legacy_public_id, sortOrder);
  const categories = [...new Set(eligibleItems.map((item) => item.category).filter((value): value is string => Boolean(value)))].sort();
  const askingValue = rows.reduce((sum, item) => sum + Number(item.asking_price || 0), 0);
  const pageSize = 60;
  const visibleRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const { data: thumbnails } = useItemThumbnails(visibleRows.map((item) => item.id));

  return <div className="flex flex-col gap-4">
    <PageHeader title="Available stuff" subtitle={isAdmin ? `${rows.length} items ready to sell · asking value ${formatMoney(askingValue)}` : `${rows.length} items ready to sell`} />
    <div className="flex flex-wrap gap-2">
      <Input type="search" placeholder="Search name or ID…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} className="max-w-xs" />
      <ItemTextScanner knownCodes={eligibleItems.flatMap((item) => [item.legacy_public_id, item.sku].filter((value): value is string => Boolean(value)))} onDone={(codes) => { setScannedCodes(codes); setPage(0); }} />
      {scannedCodes.length > 0 && <Button type="button" variant="ghost" onClick={() => setScannedCodes([])}>Clear scanned items · {scannedCodes.length}</Button>}
      <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} className="max-w-[200px]"><option value="">All categories</option>{categories.map((name) => <option key={name}>{name}</option>)}</Select>
      <Select value={chapterId} onChange={(e) => { setChapterId(e.target.value); setPage(0); }} className="max-w-[220px]"><option value="">All chapters</option>{chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</Select>
      <PublicIdSortSelect value={sortOrder} onChange={(value) => { setSortOrder(value); setPage(0); }} />
    </div>
    {scannedCodes.length > 0 && <p className="text-sm text-neutral-500">Showing {rows.length} matching item{rows.length === 1 ? "" : "s"} for scanned codes: {scannedCodes.join(", ")}</p>}
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : rows.length === 0 ? <EmptyState title={scannedCodes.length ? "No available items match the scanned codes" : "Nothing available"} /> : <TableScroll><thead><tr><Th>Item</Th><Th>Category</Th><Th>Package</Th>{isAdmin && <Th right>Bought</Th>}{isAdmin && <Th right>Asking</Th>}<Th></Th></tr></thead><tbody>
      {visibleRows.map((item) => {
        const pack = item.package_id ? packageById.get(item.package_id) : null;
        const chapter = pack ? chapterById.get(pack.chapter_id) : null;
        return <tr key={item.id}>
          <Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name} /><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link>{item.legacy_public_id && <div className="text-xs text-neutral-400">{item.legacy_public_id}</div>}</div></div></Td>
          <Td>{item.category ?? "—"}</Td><Td>{pack ? <>{pack.title}{chapter && <span className="text-neutral-400"> · {chapter.name}</span>}</> : "—"}</Td>
          {isAdmin && <Td right>{formatMoney(item.purchase_price)}</Td>}{isAdmin && <Td right>{formatMoney(item.asking_price)}</Td>}
          <Td right><Button onClick={() => setSelling(item)}>Sell</Button></Td>
        </tr>;
      })}
    </tbody></TableScroll>}
    {rows.length > pageSize && <div className="flex items-center justify-end gap-3 text-sm"><span className="text-neutral-500">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}
    {selling && <RecordAvailableSale item={selling} onClose={() => setSelling(null)} />}
  </div>;
}

function RecordAvailableSale({ item, onClose }: { item: Item; onClose: () => void }) {
  return <Modal open onClose={onClose} title={`Sell · ${item.item_name}`}><RecordItemSaleForm item={item} onSaved={onClose} /></Modal>;
}
