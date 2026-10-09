import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Field";
import {
  useAssignItemToSection,
  useClosetSections,
  useCreateClosetSection,
  useDeleteClosetSection,
  useItemsInSection,
  useRemoveItemFromSection,
  useUpdateClosetSection,
} from "@/hooks/useCloset";
import { useNonArrivingInventoryItems } from "@/hooks/useInventory";
import { useAuth } from "@/context/AuthContext";
import { useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { CodeScannerButton } from "@/components/inventory/CodeScannerButton";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { comparePublicIds, sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";

export function ClosetPage() {
  const { data: sections, isLoading } = useClosetSections();
  const { profile } = useAuth();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const { data: allItems = [] } = useNonArrivingInventoryItems();
  const matches = sortByPublicId(allItems.filter((item) => { const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean); return terms.length > 0 && terms.some((term) => [item.item_name,item.sku,item.legacy_public_id,item.brand].some((value) => value?.toLowerCase().includes(term))); }), (item) => item.legacy_public_id, sortOrder).slice(0,100);
  const { data: thumbnails } = useItemThumbnails(matches.map((item) => item.id));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Closet" subtitle={`${sections?.length ?? 0} storage spots`} actions={<Button onClick={() => setAdding(true)}>+ Section</Button>} />
      <div className="flex flex-wrap gap-2"><Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find by name, SKU, public ID or brand…" className="max-w-md" /><CodeScannerButton onDetected={(codes) => setSearch(codes.join(" "))} /><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /></div>
      {search.trim() && <div className="rounded-xl border border-neutral-200 bg-white">{matches.length ? matches.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 p-3 last:border-0"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name}/><div className="min-w-0"><div className="font-medium">{item.item_name}</div><div className="text-sm text-neutral-500">{[item.legacy_public_id,item.sku,item.brand].filter(Boolean).join(" · ")}</div></div><div className="ml-auto text-right text-sm"><div className="text-neutral-500">Location</div><div className="font-medium">{item.closet_location ?? "Not placed"}</div></div></div>) : <p className="p-3 text-sm text-neutral-500">No matching product.</p>}</div>}

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !sections || sections.length === 0 ? (
        <EmptyState title="No sections yet" subtitle="Sections are physical spots - a hanger, a box, a shelf." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpen(s.id)}
              className="rounded-xl border border-neutral-200 bg-white p-4 text-left hover:border-neutral-400"
            >
              <div className="font-medium">{s.name}</div>
            </button>
          ))}
        </div>
      )}

      {adding && <SectionFormModal onClose={() => setAdding(false)} />}
      {open && <SectionDetailModal sectionId={open} sectionName={sections?.find((s) => s.id === open)?.name ?? "Section"} isAdmin={profile?.role === "admin"} sortOrder={sortOrder} onSortOrderChange={setSortOrder} onDeleted={() => setOpen(null)} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SectionFormModal({ onClose }: { onClose: () => void }) {
  const create = useCreateClosetSection();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({ name });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title="New section">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
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

function SectionDetailModal({ sectionId, sectionName, isAdmin, sortOrder, onSortOrderChange, onClose, onDeleted }: { sectionId: string; sectionName: string; isAdmin: boolean; sortOrder: PublicIdSortOrder; onSortOrderChange: (value: PublicIdSortOrder) => void; onClose: () => void; onDeleted: () => void }) {
  const { data: placed } = useItemsInSection(sectionId);
  const { data: available } = useNonArrivingInventoryItems({});
  const assign = useAssignItemToSection();
  const remove = useRemoveItemFromSection();
  const rename = useUpdateClosetSection();
  const deleteSection = useDeleteClosetSection();
  const [itemSearch, setItemSearch] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(sectionName);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const visiblePlaced = (placed ?? []).filter((placement: any) => (available ?? []).some((item) => item.id === placement.inventory_item_id));

  return (
    <Modal open onClose={onClose} title="Section contents" wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{sectionName}</h3>
          <div className="flex gap-2">
            <PublicIdSortSelect value={sortOrder} onChange={onSortOrderChange} />
            <Button type="button" variant="secondary" onClick={() => setEditingName((value) => !value)}>{editingName ? "Cancel rename" : "Rename"}</Button>
            {isAdmin && <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete section</Button>}
          </div>
        </div>
        {editingName && <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await rename.mutateAsync({ id: sectionId, input: { name } }); setEditingName(false); }}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={rename.isPending}>{rename.isPending ? "Saving…" : "Save"}</Button>
        </form>}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200">
          {!visiblePlaced.length ? (
            <p className="p-3 text-sm text-neutral-400">Nothing placed here yet.</p>
          ) : (
            [...visiblePlaced].sort((a: any, b: any) => comparePublicIds(a.inventory_items?.legacy_public_id, b.inventory_items?.legacy_public_id, sortOrder)).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 last:border-0">
                <span className="text-sm">{p.inventory_items?.legacy_public_id ? `${p.inventory_items.legacy_public_id} · ` : ""}{p.inventory_items?.item_name ?? "—"}</span>
                <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => remove.mutate(p.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-lg border border-neutral-200 p-3">
          <div className="mb-2 flex flex-wrap gap-2"><Input type="search" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Type to find products to add…" className="flex-1" /><Button type="button" disabled={!selectedItemIds.length || assign.isPending} onClick={() => { selectedItemIds.forEach((inventoryItemId) => assign.mutate({ sectionId, inventoryItemId })); setSelectedItemIds([]); setItemSearch(""); }}>Add {selectedItemIds.length || ""} selected</Button></div>
          {itemSearch.trim() && <div className="max-h-48 overflow-y-auto rounded border border-neutral-100">{sortByPublicId((available ?? []).filter((it) => [it.item_name, it.legacy_public_id, it.sku, it.brand].some((value) => value?.toLowerCase().includes(itemSearch.trim().toLowerCase()))).slice(0, 100), (it) => it.legacy_public_id, sortOrder).map((it) => <label key={it.id} className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 p-2 text-sm last:border-0"><input type="checkbox" checked={selectedItemIds.includes(it.id)} onChange={() => setSelectedItemIds((ids) => ids.includes(it.id) ? ids.filter((id) => id !== it.id) : [...ids, it.id])} /><span>{it.legacy_public_id ? `${it.legacy_public_id} · ` : ""}{it.item_name}</span></label>)}</div>}
          {!itemSearch.trim() && <p className="text-sm text-neutral-500">Search by product name, public ID, SKU or brand, then select as many products as you need.</p>}
        </div>
      </div>
      {confirmDelete && <ConfirmDialog open title="Delete section" message="Delete this section and remove its item placements?" confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={async () => { await deleteSection.mutateAsync(sectionId); onDeleted(); }} />}
    </Modal>
  );
}
