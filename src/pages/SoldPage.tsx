import { useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { useDeleteSale, useRecordSale, useSales, useUpdateSale } from "@/hooks/useSales";
import { useInventoryItems, useItemThumbnails } from "@/hooks/useInventory";
import { ItemThumbnail } from "@/components/inventory/ItemThumbnail";
import { useAuth } from "@/context/AuthContext";

export function SoldPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: sales, isLoading } = useSales();
  const { data: thumbnails } = useItemThumbnails((sales ?? []).map((sale: any) => sale.inventory_item_id));
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [toUnsell, setToUnsell] = useState<string | null>(null);
  const unsell = useDeleteSale();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sold" subtitle={`${sales?.length ?? 0} sales`} actions={<Button onClick={() => setAdding(true)}>+ Record sale</Button>} />

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !sales || sales.length === 0 ? (
        <EmptyState title="No sales yet" />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Item</Th>
              <Th>Platform</Th>
              <Th></Th>
              {isAdmin && <Th right>Price</Th>}
              {isAdmin && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {sales.map((s: any) => (
              <tr key={s.id}>
                <Td>{formatDate(s.sale_date)}</Td>
                <Td>
                  <div className="flex items-center gap-2"><ItemThumbnail src={thumbnails?.get(s.inventory_item_id)} name={s.inventory_item?.item_name ?? "Item"} /><div><div className="font-medium">{s.inventory_item?.item_name ?? "—"}</div>{s.inventory_item?.legacy_public_id && <div className="text-xs text-neutral-400">{s.inventory_item.legacy_public_id}</div>}</div></div>
                </Td>
                <Td>{s.sale_platform ?? "—"}</Td>
                <Td><Button variant="ghost" onClick={() => setEditing(s)}>Edit</Button></Td>
                {isAdmin && <Td right>{formatMoney(s.sold_price)}</Td>}
                {isAdmin && (
                  <Td right>
                    <Button variant="ghost" onClick={() => setToUnsell(s.id)}>
                      Unsell
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}

      {adding && <RecordSaleModal onClose={() => setAdding(false)} />}
      {editing && <EditSaleModal sale={editing} isAdmin={isAdmin} onClose={() => setEditing(null)} />}

      {toUnsell && (
        <ConfirmDialog
          open
          title="Unsell this item"
          message="This deletes the sale record and returns the item to Available stock."
          confirmLabel="Unsell"
          danger
          onCancel={() => setToUnsell(null)}
          onConfirm={async () => {
            await unsell.mutateAsync(toUnsell);
            setToUnsell(null);
          }}
        />
      )}
    </div>
  );
}

function EditSaleModal({ sale, isAdmin, onClose }: { sale: any; isAdmin: boolean; onClose: () => void }) {
  const update = useUpdateSale();
  const [price, setPrice] = useState(sale.sold_price == null ? "" : String(sale.sold_price));
  const [platform, setPlatform] = useState(sale.sale_platform ?? "Other");
  const [date, setDate] = useState(sale.sale_date ?? "");
  const [buyerNote, setBuyerNote] = useState(sale.buyer_note ?? "");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await update.mutateAsync({ id: sale.id, input: { ...(isAdmin ? { sold_price: Number(price) || 0 } : {}), sale_date: date || null, sale_platform: platform || null, buyer_note: buyerNote || null } });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update this sale."); }
  }
  return <Modal open onClose={onClose} title={`Edit sale · ${sale.inventory_item?.item_name ?? "item"}`}>
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isAdmin && <Field label="Sold for"><Input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>}
      <Field label="Platform"><Select value={platform} onChange={(e) => setPlatform(e.target.value)}><option>Vinted</option><option>Plick</option><option>Cash</option><option>Other</option><option>Gift</option></Select></Field>
      <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <Field label="Buyer note"><Input value={buyerNote} onChange={(e) => setBuyerNote(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></div>
    </form>
  </Modal>;
}

function RecordSaleModal({ onClose }: { onClose: () => void }) {
  const { data: available } = useInventoryItems({ status: "available" });
  const record = useRecordSale();
  const [itemId, setItemId] = useState("");
  const [price, setPrice] = useState("");
  const [platform, setPlatform] = useState("Vinted");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!itemId) {
      setError("Choose an item.");
      return;
    }
    try {
      await record.mutateAsync({
        inventory_item_id: itemId,
        sold_price: Number(price) || 0,
        sale_platform: platform,
        sale_date: date,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title="Record a sale">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Item">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)} required>
            <option value="">Choose an item...</option>
            {(available ?? []).map((it) => (
              <option key={it.id} value={it.id}>
                {it.item_name} {it.legacy_public_id ? `(${it.legacy_public_id})` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sold for">
          <Input type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>Vinted</option>
            <option>Plick</option>
            <option>Cash</option>
            <option>Other</option>
            <option>Gift</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={record.isPending}>
            {record.isPending ? "Saving..." : "Mark as sold"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
