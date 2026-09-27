import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PhotoGallery } from "@/components/inventory/PhotoGallery";
import { useCreateInventoryItem, useInventoryItem, useUpdateInventoryItem } from "@/hooks/useInventory";
import type { Database } from "@/types/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];

function getSaveErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Could not save this item.";
}

export function InventoryItemFormPage() {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const editing = Boolean(itemId);
  const itemQuery = useInventoryItem(itemId);
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const item = itemQuery.data as Item | undefined;
  const [form, setForm] = useState({ item_name: "", category: "", brand: "", size: "", color: "", description: "", sku: "", purchase_price: "", asking_price: "0", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setForm({
      item_name: item.item_name,
      category: item.category ?? "",
      brand: item.brand ?? "",
      size: item.size ?? "",
      color: item.color ?? "",
      description: item.description ?? "",
      sku: item.sku ?? "",
      purchase_price: item.purchase_price == null ? "" : String(item.purchase_price),
      asking_price: String(item.asking_price),
      notes: item.notes ?? "",
    });
  }, [item]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: Database["public"]["Tables"]["inventory_items"]["Update"] = {
      item_name: form.item_name.trim(),
      category: form.category.trim() || null,
      brand: form.brand.trim() || null,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      description: form.description.trim() || null,
      sku: form.sku.trim() || null,
      asking_price: Number(form.asking_price) || 0,
      notes: form.notes.trim() || null,
    };
    if (!editing && searchParams.get("packageId")) payload.package_id = searchParams.get("packageId");
    if (isAdmin) payload.purchase_price = form.purchase_price === "" ? null : Number(form.purchase_price);
    try {
      const saved = editing && itemId
        ? await update.mutateAsync({ id: itemId, input: payload })
        : await create.mutateAsync(payload as Database["public"]["Tables"]["inventory_items"]["Insert"]);
      navigate(returnTo || `/inventory/${saved.id}`, { replace: true });
    } catch (err) {
      setError(getSaveErrorMessage(err));
    }
  }

  if (editing && itemQuery.isLoading) return <p className="text-sm text-neutral-500">Loading item…</p>;
  if (editing && (itemQuery.isError || !item)) return <EmptyState title="Item not found" subtitle="It may have been removed or you may not have access." />;
  const saving = create.isPending || update.isPending;

  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader title={editing ? "Edit item" : "Create item"} subtitle={editing ? item?.item_name : "Add an item to available inventory."} />
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name"><Input required autoFocus value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} /></Field>
        <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
        <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
        <Field label="Size"><Input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
        <Field label="Color"><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
        <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        {isAdmin && <Field label="Bought for"><Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></Field>}
        <Field label="Asking price"><Input type="number" min="0" step="0.01" value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} /></Field>
      </div>
      <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      {editing && itemId && <PhotoGallery inventoryItemId={itemId} />}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => navigate(returnTo || (editing && itemId ? `/inventory/${itemId}` : "/inventory"))}>Cancel</Button>
        <Button type="submit" disabled={saving || !form.item_name.trim()}>{saving ? "Saving…" : "Save item"}</Button>
      </div>
    </form>
    {!editing && <p className="text-xs text-neutral-500">You can add photos after saving the item.</p>}
    <Link to="/inventory" className="text-sm text-neutral-500 hover:underline">Back to inventory</Link>
  </div>;
}
