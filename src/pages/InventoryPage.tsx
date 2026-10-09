import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader, EmptyState, Badge } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { Input, Select } from "@/components/ui/Field";
import { formatMoney } from "@/lib/format";
import { useCategories, useDeleteInventoryItem, useNonArrivingInventoryItems } from "@/hooks/useInventory";
import { useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import { useAuth } from "@/context/AuthContext";
import type { Database, InventoryStatus } from "@/types/database.types";

type InventoryRow = Database["public"]["Tables"]["inventory_items"]["Row"];

const STATUS_TONE: Record<InventoryStatus, "neutral" | "good" | "bad" | "warn"> = {
  available: "neutral",
  listed: "warn",
  sold: "good",
  traded: "warn",
  archived: "bad",
};

export function InventoryPage() {
  const [searchParams] = useSearchParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [status, setStatus] = useState<InventoryStatus | "">(() => searchParams.get("status") as InventoryStatus | "" ?? "");
  const [category, setCategory] = useState(() => searchParams.get("category") ?? "");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>(() => searchParams.get("sort") === "newest" ? "newest" : "oldest");
  const [page, setPage] = useState(() => Number(searchParams.get("page")) || 0);
  const [toDelete, setToDelete] = useState<InventoryRow | null>(null);
  const deleteItem = useDeleteInventoryItem();

  const { data: items, isLoading } = useNonArrivingInventoryItems({
    status: status || undefined,
    category: category || undefined,
    search: search || undefined,
  });
  const pageSize = 60;
  const sortedItems = sortByPublicId(items ?? [], (item) => item.legacy_public_id, sortOrder);
  const visibleItems = sortedItems.slice(page * pageSize, (page + 1) * pageSize);
  const { data: thumbnails } = useItemThumbnails(visibleItems.map((item) => item.id));
  const { data: categories } = useCategories();
  const returnTo = `/inventory?${new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}), ...(search ? { search } : {}), ...(sortOrder !== "newest" ? { sort: sortOrder } : {}), ...(page ? { page: String(page) } : {}) }).toString()}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Inventory"
        subtitle={`${items?.length ?? 0} items`}
        actions={<Link to={`/inventory/new?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">+ Add item</Link>}
      />

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name or ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-xs" />
        <PublicIdSortSelect value={sortOrder} onChange={(value) => { setSortOrder(value); setPage(0); }} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value as InventoryStatus | ""); setPage(0); }} className="max-w-[180px]">
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
          <option value="traded">Traded</option>
          <option value="archived">Archived</option>
        </Select>
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }} className="max-w-[180px]">
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !items || items.length === 0 ? (
        <EmptyState title="No items match" subtitle="Try clearing filters, or add your first item." />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th>Category</Th>
              {isAdmin && <Th right>Bought</Th>}
              <Th right>Asking</Th>
              {isAdmin && <Th right>Sold for</Th>}
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((it) => (
              <tr key={it.id} className="hover:bg-neutral-50">
                <Td>
                  <div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(it.id)} name={it.item_name} /><div><Link to={`/inventory/${it.id}`} className="font-medium hover:underline">{it.item_name}</Link>{it.legacy_public_id && <div className="text-xs text-neutral-400">{it.legacy_public_id}</div>}</div></div>
                </Td>
                <Td>{it.category ?? "—"}</Td>
                {isAdmin && <Td right>{formatMoney(it.purchase_price)}</Td>}
                <Td right>{formatMoney(it.asking_price)}</Td>
                {isAdmin && <Td right>{formatMoney(it.sold_price)}</Td>}
                <Td>
                  <Badge tone={STATUS_TONE[it.status]}>{it.status}</Badge>
                </Td>
                <Td right>
                  <div className="flex justify-end gap-2">
                    <Link to={`/inventory/${it.id}/edit?returnTo=${encodeURIComponent(returnTo)}`} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100">Edit</Link>
                    {isAdmin && (
                      <Button variant="ghost" onClick={() => setToDelete(it)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}

      {!isLoading && (items?.length ?? 0) > pageSize && <div className="flex items-center justify-end gap-3 text-sm"><span className="text-neutral-500">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, items?.length ?? 0)} of {items?.length}</span><Button variant="secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="secondary" disabled={(page + 1) * pageSize >= (items?.length ?? 0)} onClick={() => setPage((value) => value + 1)}>Next</Button></div>}

      {toDelete && <ConfirmDialog open title="Delete item" message={`Delete “${toDelete.item_name}” permanently?`} confirmLabel="Delete" danger onCancel={() => setToDelete(null)} onConfirm={async () => { await deleteItem.mutateAsync(toDelete.id); setToDelete(null); }} />}

    </div>
  );
}
