import { useState } from "react";
import { PageHeader, EmptyState, Badge } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { formatDate } from "@/lib/format";
import { useCreateTrade, useDeleteTrade, useReturnSale, useTrades } from "@/hooks/useTrades";
import { useInventoryItems } from "@/hooks/useInventory";
import { useSales } from "@/hooks/useSales";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { TradeKind } from "@/types/database.types";

export function TradesPage() {
  const { data: trades, isLoading } = useTrades();
  const { data: items } = useInventoryItems();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const remove = useDeleteTrade();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Trades" subtitle={`${trades?.length ?? 0} recorded`} actions={<Button onClick={() => setAdding(true)}>+ Trade</Button>} />

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !trades || trades.length === 0 ? (
        <EmptyState title="No trades yet" subtitle="Record swaps, bundles, and returns here." />
      ) : (
        <div className="flex flex-col gap-2">
      {trades.map((t) => (
            <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{t.received_name}</span>{" "}
                  <Badge tone={t.kind === "return-exchange" ? "warn" : "neutral"}>
                    {t.kind === "return-exchange" ? "Return / exchange" : "Trade"}
                  </Badge>
                </div>
                <span className="text-sm text-neutral-400">{formatDate(t.trade_date)}</span>
                {isAdmin && <Button variant="ghost" onClick={() => setDeleting(t.id)}>Delete</Button>}
              </div>
              {t.notes && <p className="mt-2 text-sm text-neutral-600">{t.notes}</p>}
              {t.selected_item_ids.length > 0 && <ul className="mt-3 list-inside list-disc text-sm text-neutral-600">{t.selected_item_ids.map((id) => {
                const item = (items ?? []).find((candidate) => candidate.id === id);
                return <li key={id}>{item ? `${item.legacy_public_id ? `${item.legacy_public_id} · ` : ""}${item.item_name}` : "Linked item"}</li>;
              })}</ul>}
            </div>
          ))}
        </div>
      )}

      {adding && <TradeFormModal onClose={() => setAdding(false)} />}
      {deleting && <ConfirmDialog open title="Delete trade" message="Delete this trade record?" confirmLabel="Delete" danger onCancel={() => setDeleting(null)} onConfirm={async () => { await remove.mutateAsync(deleting); setDeleting(null); }} />}
    </div>
  );
}

function TradeFormModal({ onClose }: { onClose: () => void }) {
  const create = useCreateTrade();
  const { data: inventory } = useInventoryItems();
  const [receivedName, setReceivedName] = useState("");
  const [kind, setKind] = useState<TradeKind>("standard-trade");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const { data: sales = [] } = useSales();
  const returnSale = useReturnSale();
  const [saleId, setSaleId] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (kind === "return-exchange") {
        if (!saleId) throw new Error("Choose the sold item being returned.");
        await returnSale.mutateAsync({ saleId, receivedName, date });
      } else await create.mutateAsync({ received_name: receivedName, kind, trade_date: date, notes: notes || null, selected_item_ids: selectedItemIds, active_item_id: selectedItemIds[0] ?? null });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title="New trade">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="What you received">
          <Input required value={receivedName} onChange={(e) => setReceivedName(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={kind} onChange={(e) => setKind(e.target.value as TradeKind)}>
            <option value="standard-trade">Trade</option>
            <option value="return-exchange">Return / exchange</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {kind === "return-exchange" ? <Field label="Sold item being returned"><Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID or SKU…" /><div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-neutral-200">{sales.filter((sale: any) => { const q = search.toLowerCase(); const item = sale.inventory_item; return !q || [item?.item_name,item?.legacy_public_id,item?.sku].some((v) => v?.toLowerCase().includes(q)); }).slice(0,80).map((sale: any) => <label key={sale.id} className="flex cursor-pointer gap-2 border-b border-neutral-100 p-2 text-sm"><input type="radio" name="returned-sale" checked={saleId === sale.id} onChange={() => setSaleId(sale.id)} /><span>{sale.inventory_item?.item_name} <span className="text-neutral-400">{sale.inventory_item?.legacy_public_id}</span></span></label>)}</div></Field> : <Field label="Items involved">
          <div className="max-h-48 overflow-y-auto rounded-lg border border-neutral-200 p-2">
            {(inventory ?? []).filter((item) => { const q = search.toLowerCase(); return !q || [item.item_name,item.legacy_public_id,item.sku,item.brand].some((v) => v?.toLowerCase().includes(q)); }).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 border-b border-neutral-100 py-2 text-sm last:border-0">
              <input type="checkbox" checked={selectedItemIds.includes(item.id)} onChange={(e) => setSelectedItemIds(e.target.checked ? [...selectedItemIds, item.id] : selectedItemIds.filter((id) => id !== item.id))} />
              <span>{item.legacy_public_id ? `${item.legacy_public_id} · ` : ""}{item.item_name}</span>
            </label>)}
            {inventory?.length === 0 && <span className="text-sm text-neutral-400">No inventory items yet.</span>}
          </div>
        </Field>}
        {kind === "standard-trade" && <Field label="Search items"><Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, ID, SKU or brand…" /></Field>}
        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending || returnSale.isPending}>
            {create.isPending || returnSale.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
