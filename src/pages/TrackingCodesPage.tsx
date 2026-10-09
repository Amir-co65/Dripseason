import { useMemo, useState } from "react";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { TableScroll, Td, Th } from "@/components/ui/Table";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { useChapters, usePackages } from "@/hooks/useChapters";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import type { Database } from "@/types/database.types";

type Package = Database["public"]["Tables"]["packages"]["Row"];

export function TrackingCodesPage() {
  const { data: packages = [], isLoading } = usePackages();
  const { data: chapters = [] } = useChapters();
  const { data: inventory = [] } = useInventoryItems();
  const [selected, setSelected] = useState<Package | null>(null);
  const incoming = packages.filter((pack) => pack.arrival_status === "arriving" && pack.shipping_code?.trim());
  const incomingIds = new Set(incoming.map((pack) => pack.id));
  const itemsByPackage = useMemo(() => {
    const grouped = new Map<string, typeof inventory>();
    for (const item of inventory) {
      if (!item.package_id || !incomingIds.has(item.package_id)) continue;
      grouped.set(item.package_id, [...(grouped.get(item.package_id) ?? []), item]);
    }
    return grouped;
  }, [inventory, incomingIds]);
  const selectedItems = selected ? itemsByPackage.get(selected.id) ?? [] : [];
  const { data: thumbnails } = useItemThumbnails(selectedItems.map((item) => item.id));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));

  return <div className="flex flex-col gap-4">
    <PageHeader title="Tracking codes" subtitle={`${incoming.length} arriving package${incoming.length === 1 ? "" : "s"} with tracking codes`} />
    {isLoading ? <p className="text-sm text-neutral-400">Loading…</p> : !incoming.length ? <EmptyState title="No packages being tracked" subtitle="Add a tracking code to an arriving package from Hauls." /> : <TableScroll><thead><tr><Th>Paketti number</Th><Th>Package / haul</Th><Th>Tracking code</Th><Th></Th></tr></thead><tbody>
      {incoming.map((pack) => <tr key={pack.id}><Td className="font-medium">{pack.package_number ?? pack.title}</Td><Td>{pack.title}<div className="text-xs text-neutral-500">{chapterById.get(pack.chapter_id)?.name ?? "Haul"}</div></Td><Td><span className="font-mono text-sm">{pack.shipping_code}</span></Td><Td right><button type="button" onClick={() => setSelected(pack)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-neutral-100">Open package</button></Td></tr>)}
    </tbody></TableScroll>}
    {selected && <Modal open onClose={() => setSelected(null)} title={selected.title}><div className="flex flex-col gap-3"><p className="text-sm text-neutral-500">{chapterById.get(selected.chapter_id)?.name ?? "Haul"} · Paketti {selected.package_number ?? "—"}</p><div className="rounded-lg bg-neutral-50 p-3"><div className="text-xs text-neutral-500">Tracking code</div><div className="font-mono font-semibold">{selected.shipping_code}</div></div><div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200">{selectedItems.length ? selectedItems.map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-neutral-100 p-2 last:border-0"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name} /><div className="min-w-0"><div className="truncate text-sm font-medium">{item.item_name}</div><div className="text-xs capitalize text-neutral-500">{item.status === "available" ? "Unsold" : item.status}</div></div></div>) : <p className="p-3 text-sm text-neutral-500">No products have been added to this package yet.</p>}</div></div></Modal>}
  </div>;
}
