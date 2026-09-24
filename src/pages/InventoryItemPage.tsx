import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { PhotoGallery } from "@/components/inventory/PhotoGallery";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, EmptyState, PageHeader } from "@/components/ui/Display";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useDeleteInventoryItem, useInventoryItem } from "@/hooks/useInventory";
import { useRecordSale, useSales } from "@/hooks/useSales";
import { formatDate, formatMoney } from "@/lib/format";
import type { Database, InventoryStatus } from "@/types/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];
const statusTone: Record<InventoryStatus, "neutral" | "good" | "bad" | "warn"> = { available: "neutral", listed: "warn", sold: "good", traded: "warn", archived: "bad" };

export function InventoryItemPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data, isLoading, isError } = useInventoryItem(itemId);
  const item = data as Item | undefined;
  const { data: sales } = useSales();
  const remove = useDeleteInventoryItem();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return <p className="text-sm text-neutral-500">Loading item…</p>;
  if (isError || !item) return <EmptyState title="Item not found" subtitle="It may have been removed or you may not have access." />;
  const itemSales = (sales ?? []).filter((sale) => sale.inventory_item_id === item.id);

  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <PageHeader title={item.item_name} subtitle={item.legacy_public_id ? `Project26 ID · ${item.legacy_public_id}` : item.sku ? `SKU · ${item.sku}` : "Inventory item"}
      actions={<><Button variant="secondary" onClick={() => navigate("/inventory")}>Back</Button><Button onClick={() => navigate(`/inventory/${item.id}/edit`)}>Edit item</Button></>} />
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Item details</h2><Badge tone={statusTone[item.status]}>{item.status}</Badge></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Detail label="Category" value={item.category} />
          <Detail label="Brand" value={item.brand} />
          <Detail label="Size" value={item.size} />
          <Detail label="Color" value={item.color} />
          <Detail label="SKU" value={item.sku} />
          <Detail label="Asking price" value={formatMoney(item.asking_price)} />
          {isAdmin && <Detail label="Bought for" value={formatMoney(item.purchase_price)} />}
          {isAdmin && <Detail label="Sold for" value={formatMoney(item.sold_price)} />}
          <Detail label="Added" value={formatDate(item.created_at)} />
        </dl>
        {item.description && <div><h3 className="mb-1 text-sm font-medium">Description</h3><p className="whitespace-pre-wrap text-sm text-neutral-600">{item.description}</p></div>}
        {item.notes && <div><h3 className="mb-1 text-sm font-medium">Notes</h3><p className="whitespace-pre-wrap text-sm text-neutral-600">{item.notes}</p></div>}
      </section>
      <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><PhotoGallery inventoryItemId={item.id} /></section>
    </div>
    {item.status === "available" && <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="mb-3 font-semibold">Mark as sold</h2><RecordItemSaleForm item={item} /></section>}
    {itemSales.length > 0 && <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6"><h2 className="mb-3 font-semibold">Sale history</h2><div className="divide-y divide-neutral-100">{itemSales.map((sale) => <div key={sale.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{formatDate(sale.sale_date)} · {sale.sale_platform ?? "—"}</span><span>{isAdmin ? formatMoney(sale.sold_price) : "Recorded"}</span></div>)}</div></section>}
    <div className="flex justify-end">{isAdmin && <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete item</Button>}</div>
    {confirmDelete && <ConfirmDialog open title="Delete item" message={`Permanently delete “${item.item_name}”?`} confirmLabel="Delete" danger onCancel={() => setConfirmDelete(false)} onConfirm={async () => { await remove.mutateAsync(item.id); navigate("/inventory", { replace: true }); }} />}
    <Link to="/inventory" className="text-sm text-neutral-500 hover:underline">Back to inventory</Link>
  </div>;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-neutral-500">{label}</dt><dd className="mt-0.5 font-medium">{value || "—"}</dd></div>;
}

export function RecordItemSaleForm({ item }: { item: Item }) {
  const record = useRecordSale();
  const [price, setPrice] = useState(String(item.asking_price));
  const [platform, setPlatform] = useState("Vinted");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [buyerNote, setBuyerNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await record.mutateAsync({ inventory_item_id: item.id, sold_price: Number(price) || 0, sale_platform: platform, sale_date: date, buyer_note: buyerNote || null });
    } catch (err) { setError(err instanceof Error ? err.message : "Could not record the sale."); }
  }
  return <form onSubmit={submit} className="flex flex-col gap-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Field label="Sold for"><Input required min="0" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <Field label="Platform"><Select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>Vinted</option><option>Plick</option><option>Cash</option><option>Other</option><option>Gift</option></Select></Field>
      <Field label="Sale date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
    </div>
    <Field label="Buyer note"><Textarea rows={2} value={buyerNote} onChange={(e) => setBuyerNote(e.target.value)} /></Field>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div><Button type="submit" disabled={record.isPending}>{record.isPending ? "Recording…" : "Mark as sold"}</Button></div>
  </form>;
}
