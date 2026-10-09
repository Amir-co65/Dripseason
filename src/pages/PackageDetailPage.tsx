import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { RecordItemSaleForm } from "@/pages/InventoryItemPage";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/Display";
import { Modal } from "@/components/ui/Modal";
import { TableScroll, Td, Th } from "@/components/ui/Table";
import { useChapters, usePackage } from "@/hooks/useChapters";
import { useInventoryItems } from "@/hooks/useInventory";
import { useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { CopyablePublicId } from "@/components/inventory/CopyablePublicId";
import { PublicIdSortSelect } from "@/components/inventory/PublicIdSortSelect";
import { sortByPublicId, type PublicIdSortOrder } from "@/lib/inventorySort";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];

export function PackageDetailPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: packageRow, isLoading } = usePackage(packageId);
  const { data: chapters = [] } = useChapters();
  const { data: items = [] } = useInventoryItems({ packageId });
  const [sortOrder, setSortOrder] = useState<PublicIdSortOrder>("oldest");
  const sortedItems = sortByPublicId(items, (item) => item.legacy_public_id, sortOrder);
  const { data: thumbnails } = useItemThumbnails(sortedItems.map((item) => item.id));
  const [saleTarget, setSaleTarget] = useState<Item | null>(null);
  const chapter = chapters.find((item) => item.id === packageRow?.chapter_id);
  const itemCost = items.reduce((total, item) => total + Number(item.purchase_price ?? 0), 0);
  const spent = itemCost + Number(packageRow?.shipping_cost ?? 0);
  const won = items.reduce((total, item) => total + (item.status === "sold" ? Number(item.sold_price ?? 0) : 0), 0);
  const estimate = items.reduce((total, item) => total + Number(item.asking_price ?? 0), 0);

  if (isLoading) return <p className="text-sm text-neutral-400">Loading…</p>;
  if (!packageRow) return <EmptyState title="Package not found" />;

  return <div className="flex flex-col gap-4">
    <PageHeader
      title={packageRow.title}
      subtitle={`${chapter?.name ?? "Hauls"} · ${packageRow.package_date ?? "no date"}${packageRow.info ? ` · ${packageRow.info}` : ""}${packageRow.shipping_code ? ` · ${packageRow.shipping_code}` : ""}`}
      actions={<><Button variant="secondary" onClick={() => navigate("/hauls")}>Back</Button><Link to={`/inventory/new?packageId=${encodeURIComponent(packageRow.id)}`} className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white">+ Item</Link></>}
    />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <Metric label="Items" value={`${items.filter((item) => item.status === "sold").length}/${items.length} sold`} />
      {isAdmin && <Metric label="Spent" value={formatMoney(spent)} />}
      {isAdmin && <Metric label="Est. sales" value={formatMoney(estimate)} />}
      {isAdmin && <Metric label="Won" value={formatMoney(won)} />}
      {isAdmin && <Metric label="Profit" value={formatMoney(won - spent)} />}
    </div>
    {items.length === 0 ? <EmptyState title="No items in this package" subtitle="Add the package items here." /> : <><div className="flex justify-end"><PublicIdSortSelect value={sortOrder} onChange={setSortOrder} /></div><TableScroll><thead><tr><Th>Item</Th><Th>Category</Th>{isAdmin && <Th right>Bought</Th>}{isAdmin && <Th right>Sell for</Th>}{isAdmin && <Th right>Sold for</Th>}<Th>Status</Th><Th></Th></tr></thead><tbody>
      {sortedItems.map((item) => <tr key={item.id}>
        <Td><div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(item.id)} name={item.item_name} /><div><Link to={`/inventory/${item.id}`} className="font-medium hover:underline">{item.item_name}</Link>{item.legacy_public_id && <div className="text-xs text-neutral-400"><CopyablePublicId value={item.legacy_public_id} /></div>}</div></div></Td>
        <Td>{item.category ?? "—"}</Td>{isAdmin && <Td right>{formatMoney(item.purchase_price)}</Td>}{isAdmin && <Td right>{formatMoney(item.asking_price)}</Td>}{isAdmin && <Td right>{formatMoney(item.sold_price)}</Td>}
        <Td><Badge tone={item.status === "sold" ? "good" : "neutral"}>{item.status === "sold" ? "Sold" : "Unsold"}</Badge></Td>
        <Td right>{item.status === "available" ? <Button variant="secondary" onClick={() => setSaleTarget(item)}>Sell</Button> : <Link to={`/inventory/${item.id}`} className="text-sm underline">Open</Link>}</Td>
      </tr>)}
    </tbody></TableScroll></>}
    {saleTarget && <Modal open onClose={() => setSaleTarget(null)} title={`Sell · ${saleTarget.item_name}`}><RecordItemSaleForm item={saleTarget} /></Modal>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-white p-4"><div className="text-xs text-neutral-500">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
