import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, EmptyState } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { formatMoney } from "@/lib/format";
import { useChapters, useCreateChapter, usePackages, useCreatePackage, useDeletePackage, useUpdatePackage } from "@/hooks/useChapters";
import { useAuth } from "@/context/AuthContext";
import { useInventoryItems } from "@/hooks/useInventory";
import type { Database } from "@/types/database.types";

type Chapter = Database["public"]["Tables"]["chapters"]["Row"];
type Package = Database["public"]["Tables"]["packages"]["Row"];

export function HaulsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: chapters, isLoading } = useChapters();
  const { data: inventory } = useInventoryItems();
  const { data: allPackages = [] } = usePackages();
  const itemCounts = new Map<string, number>();
  for (const item of inventory ?? []) if (item.package_id) itemCounts.set(item.package_id, (itemCounts.get(item.package_id) ?? 0) + 1);
  const [openChapter, setOpenChapter] = useState<string | null>(null);
  const [addingChapter, setAddingChapter] = useState(false);
  const [search, setSearch] = useState("");
  const packageById = new Map(allPackages.map((item) => [item.id, item]));
  const chapterById = new Map((chapters ?? []).map((item) => [item.id, item]));
  const needle = search.trim().toLocaleLowerCase();
  const matchingItems = needle ? (inventory ?? []).filter((item) => {
    const pack = item.package_id ? packageById.get(item.package_id) : null;
    return item.item_name.toLocaleLowerCase().includes(needle)
      || (item.legacy_public_id ?? "").toLocaleLowerCase().includes(needle)
      || (pack?.title ?? "").toLocaleLowerCase().includes(needle);
  }).slice(0, 200) : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Hauls"
        subtitle={`${chapters?.length ?? 0} chapters`}
        actions={isAdmin ? <Button onClick={() => setAddingChapter(true)}>+ Chapter</Button> : undefined}
      />

      <Input type="search" placeholder="Search items, IDs, packages…" value={search} onChange={(event) => setSearch(event.target.value)} />

      {needle ? (
        !matchingItems.length ? <EmptyState title="No matches" /> : <TableScroll><thead><tr><Th>Item</Th><Th>Package</Th>{isAdmin && <Th right>Bought</Th>}{isAdmin && <Th right>Sell for</Th>}{isAdmin && <Th right>Sold for</Th>}<Th>Status</Th></tr></thead><tbody>
          {matchingItems.map((item) => { const pack = item.package_id ? packageById.get(item.package_id) : null; const chapter = pack ? chapterById.get(pack.chapter_id) : null; return <tr key={item.id}><Td><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link>{item.legacy_public_id && <div className="text-xs text-neutral-400">{item.legacy_public_id}</div>}</Td><Td>{pack ? <>{pack.title}{chapter && <span className="text-neutral-400"> · {chapter.name}</span>}</> : "—"}</Td>{isAdmin && <Td right>{formatMoney(item.purchase_price)}</Td>}{isAdmin && <Td right>{formatMoney(item.asking_price)}</Td>}{isAdmin && <Td right>{item.status === "sold" ? formatMoney(item.sold_price) : "—"}</Td>}<Td>{item.status === "sold" ? "Sold" : "Unsold"}</Td></tr>; })}
        </tbody></TableScroll>
      ) : isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !chapters || chapters.length === 0 ? (
        <EmptyState title="No chapters yet" subtitle="Add a chapter, then packages inside it." />
      ) : (
        <div className="flex flex-col gap-2">
          {chapters.map((c) => (
            <ChapterRow key={c.id} chapter={c} open={openChapter === c.id} onToggle={() => setOpenChapter(openChapter === c.id ? null : c.id)} isAdmin={isAdmin} itemCounts={itemCounts} />
          ))}
        </div>
      )}

      {addingChapter && <ChapterFormModal onClose={() => setAddingChapter(false)} />}
    </div>
  );
}

function ChapterRow({ chapter, open, onToggle, isAdmin, itemCounts }: { chapter: Chapter; open: boolean; onToggle: () => void; isAdmin: boolean; itemCounts: Map<string, number> }) {
  const { data: packages } = usePackages(open ? chapter.id : undefined);
  const [addingPackage, setAddingPackage] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<string | null>(null);
  const deletePackage = useDeletePackage();

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
        <span className="font-semibold">{chapter.name}</span>
        {chapter.date_range && <span className="text-sm text-neutral-400">{chapter.date_range}</span>}
      </button>

      {open && (
        <div className="border-t border-neutral-100 p-3">
          {isAdmin && (
            <div className="mb-2 flex justify-end">
              <Button variant="secondary" onClick={() => setAddingPackage(true)}>
                + Package
              </Button>
            </div>
          )}
          {!packages || packages.length === 0 ? (
            <p className="p-2 text-sm text-neutral-400">No packages in this chapter yet.</p>
          ) : (
            <TableScroll>
              <thead>
                <tr>
                  <Th>Package</Th>
                  <Th>Date</Th>
                  <Th>Arrival</Th>
                  <Th>Items</Th>
                  {isAdmin && <Th></Th>}
                  <Th></Th>
                  {isAdmin && <Th right>Shipping</Th>}
                </tr>
              </thead>
              <tbody>
                {packages.map((p) => (
                  <tr key={p.id}>
                    <Td>
                      <Link to={`/hauls/packages/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                      {p.info && <div className="text-xs text-neutral-400">{p.info}</div>}
                    </Td>
                    <Td>{p.package_date ?? "—"}</Td>
                    <Td>{p.arrival_status ?? "—"}</Td>
                    <Td>{itemCounts.get(p.id) ?? 0}</Td>
                    {isAdmin && <Td><Button type="button" variant="ghost" onClick={() => setEditingPackage(p)}>Edit</Button><Button type="button" variant="ghost" onClick={() => setDeletingPackage(p.id)}>Delete</Button></Td>}
                    <Td right><Link to={`/inventory/new?packageId=${encodeURIComponent(p.id)}`} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100">+ Add item</Link></Td>
                    {isAdmin && <Td right>{formatMoney(p.shipping_cost)}</Td>}
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
        </div>
      )}

      {addingPackage && <PackageFormModal chapterId={chapter.id} onClose={() => setAddingPackage(false)} />}
      {editingPackage && <PackageFormModal chapterId={chapter.id} packageItem={editingPackage} onClose={() => setEditingPackage(null)} />}
      {deletingPackage && <ConfirmDialog open title="Delete package" message="Delete this package? Its inventory items will stay in inventory without a package link." confirmLabel="Delete" danger onCancel={() => setDeletingPackage(null)} onConfirm={async () => { await deletePackage.mutateAsync(deletingPackage); setDeletingPackage(null); }} />}
    </div>
  );
}

function ChapterFormModal({ onClose }: { onClose: () => void }) {
  const create = useCreateChapter();
  const [name, setName] = useState("");
  const [dateRange, setDateRange] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name, date_range: dateRange || null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title="New chapter">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Date range">
          <Input value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="e.g. 21.1" />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function PackageFormModal({ chapterId, packageItem, onClose }: { chapterId: string; packageItem?: Package; onClose: () => void }) {
  const create = useCreatePackage();
  const update = useUpdatePackage();
  const [title, setTitle] = useState(packageItem?.title ?? "");
  const [info, setInfo] = useState(packageItem?.info ?? "");
  const [shippingCost, setShippingCost] = useState(String(packageItem?.shipping_cost ?? 0));
  const [packageDate, setPackageDate] = useState(packageItem?.package_date ?? "");
  const [shippingCode, setShippingCode] = useState(packageItem?.shipping_code ?? "");
  const [arrivalStatus, setArrivalStatus] = useState(packageItem?.arrival_status ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = { title, info: info || null, shipping_cost: Number(shippingCost) || 0, package_date: packageDate || null, shipping_code: shippingCode || null, arrival_status: arrivalStatus ? arrivalStatus as "arrived" | "arriving" : null };
      if (packageItem) await update.mutateAsync({ id: packageItem.id, input });
      else await create.mutateAsync({ chapter_id: chapterId, ...input });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title={packageItem ? "Edit package" : "New package"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Title">
          <Input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Info">
          <Textarea rows={2} value={info} onChange={(e) => setInfo(e.target.value)} />
        </Field>
        <Field label="Date"><Input value={packageDate} onChange={(e) => setPackageDate(e.target.value)} placeholder="e.g. 21.4" /></Field>
        <Field label="Tracking code"><Input value={shippingCode} onChange={(e) => setShippingCode(e.target.value)} /></Field>
        <Field label="Arrival status"><Select value={arrivalStatus} onChange={(e) => setArrivalStatus(e.target.value as "" | "arrived" | "arriving")}><option value="">Not set</option><option value="arriving">Arriving</option><option value="arrived">Arrived</option></Select></Field>
        <Field label="Shipping cost">
          <Input type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Saving..." : packageItem ? "Save" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
