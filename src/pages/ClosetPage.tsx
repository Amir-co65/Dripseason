import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  useAssignItemToSection,
  useClosetSections,
  useCreateClosetSection,
  useDeleteClosetSection,
  useItemsInSection,
  useRemoveItemFromSection,
  useUpdateClosetSection,
} from "@/hooks/useCloset";
import { useInventoryItems } from "@/hooks/useInventory";
import { useAuth } from "@/context/AuthContext";

export function ClosetPage() {
  const { data: sections, isLoading } = useClosetSections();
  const { profile } = useAuth();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Closet" subtitle={`${sections?.length ?? 0} storage spots`} actions={<Button onClick={() => setAdding(true)}>+ Section</Button>} />

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
      {open && <SectionDetailModal sectionId={open} sectionName={sections?.find((s) => s.id === open)?.name ?? "Section"} isAdmin={profile?.role === "admin"} onDeleted={() => setOpen(null)} onClose={() => setOpen(null)} />}
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

function SectionDetailModal({ sectionId, sectionName, isAdmin, onClose, onDeleted }: { sectionId: string; sectionName: string; isAdmin: boolean; onClose: () => void; onDeleted: () => void }) {
  const { data: placed } = useItemsInSection(sectionId);
  const { data: available } = useInventoryItems({});
  const assign = useAssignItemToSection();
  const remove = useRemoveItemFromSection();
  const rename = useUpdateClosetSection();
  const deleteSection = useDeleteClosetSection();
  const [itemToAdd, setItemToAdd] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(sectionName);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Modal open onClose={onClose} title="Section contents" wide>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{sectionName}</h3>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditingName((value) => !value)}>{editingName ? "Cancel rename" : "Rename"}</Button>
            {isAdmin && <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>Delete section</Button>}
          </div>
        </div>
        {editingName && <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); await rename.mutateAsync({ id: sectionId, input: { name } }); setEditingName(false); }}>
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={rename.isPending}>{rename.isPending ? "Saving…" : "Save"}</Button>
        </form>}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-200">
          {!placed || placed.length === 0 ? (
            <p className="p-3 text-sm text-neutral-400">Nothing placed here yet.</p>
          ) : (
            placed.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 last:border-0">
                <span className="text-sm">{p.inventory_items?.item_name ?? "—"}</span>
                <button className="text-xs text-neutral-400 hover:text-red-600" onClick={() => remove.mutate(p.id)}>
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <Select value={itemToAdd} onChange={(e) => setItemToAdd(e.target.value)} className="flex-1">
            <option value="">Add an item to this section...</option>
            {(available ?? []).map((it) => (
              <option key={it.id} value={it.id}>
                {it.item_name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            disabled={!itemToAdd}
            onClick={() => {
              if (itemToAdd) assign.mutate({ sectionId, inventoryItemId: itemToAdd });
              setItemToAdd("");
            }}
          >
            Add
          </Button>
        </div>
      </div>
      {confirmDelete && <ConfirmDialog open title="Delete section" message="Delete this section and remove its item placements?" confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={async () => { await deleteSection.mutateAsync(sectionId); onDeleted(); }} />}
    </Modal>
  );
}
