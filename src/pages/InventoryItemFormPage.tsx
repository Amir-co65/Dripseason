import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader } from "@/components/ui/Display";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { PhotoGallery } from "@/components/inventory/PhotoGallery";
import { useCreateInventoryItem, useInventoryItem, useUpdateInventoryItem } from "@/hooks/useInventory";
import { usePackage } from "@/hooks/useChapters";
import type { Database } from "@/types/database.types";

type Item = Database["public"]["Tables"]["inventory_items"]["Row"];

function inferCategory(name: string) {
  const value = name.toLocaleLowerCase();
  const categories: [RegExp, string][] = [
    [/\b(sneaker|trainer|shoe|shoes|boot|boots|sandal|heels?)\b/, "Shoes"],
    [/\b(hoodie|sweatshirt|sweater|jumper|pullover)\b/, "Sweaters & Hoodies"],
    [/\b(jacket|coat|parka|blazer|vest|gilet)\b/, "Jackets & Coats"],
    [/\b(jeans?|trousers?|pants|leggings|joggers?)\b/, "Pants"],
    [/\b(shorts?)\b/, "Shorts"],
    [/\b(dress|skirt|jumpsuit|romper)\b/, "Dresses & Skirts"],
    [/\b(t-?shirt|tee|tank top|crop top|top)\b/, "Tops"],
    [/\b(shirt|blouse|polo)\b/, "Shirts"],
    [/\b(bag|backpack|purse|handbag|wallet)\b/, "Bags & Wallets"],
    [/\b(cap|hat|beanie|scarf|belt|gloves)\b/, "Accessories"],
    [/\b(ring|necklace|bracelet|earrings?|jewelry|jewellery|watch)\b/, "Jewelry"],
  ];
  return categories.find(([pattern]) => pattern.test(value))?.[1] ?? "Other";
}

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
  const item = itemQuery.data as Item | undefined;
  const { data: itemPackage, isLoading: packageLoading, isError: packageError } = usePackage(item?.package_id ?? undefined);
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const [form, setForm] = useState({ item_name: "", category: "Other", purchase_price: "", asking_price: "0", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setForm({
      item_name: item.item_name,
      category: inferCategory(item.item_name),
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
      category: inferCategory(form.item_name),
      asking_price: Number(form.asking_price) || 0,
      notes: form.notes.trim() || null,
    };
    if (!editing && searchParams.get("packageId")) payload.package_id = searchParams.get("packageId");
    if (isAdmin) payload.purchase_price = form.purchase_price === "" ? null : Number(form.purchase_price);
    try {
      const saved = editing && itemId
        ? await update.mutateAsync({ id: itemId, input: payload })
        : await create.mutateAsync(payload as Database["public"]["Tables"]["inventory_items"]["Insert"]);
      const packageId = searchParams.get("packageId");
      navigate(returnTo || (packageId ? `/hauls/packages/${packageId}` : `/inventory/${saved.id}`), { replace: true });
    } catch (err) {
      setError(getSaveErrorMessage(err));
    }
  }

  if (editing && (itemQuery.isLoading || (item?.package_id && packageLoading))) return <p className="text-sm text-neutral-500">Loading item…</p>;
  if (editing && (itemQuery.isError || !item)) return <EmptyState title="Item not found" subtitle="It may have been removed or you may not have access." />;
  if (editing && item?.package_id && packageError) return <EmptyState title="Arrival status unavailable" subtitle="Open this item from its package in Hauls." />;
  if (editing && itemPackage?.arrival_status === "arriving") return <EmptyState title="This item has not arrived yet" subtitle="Edit it from its package in Hauls after it arrives." />;
  const saving = create.isPending || update.isPending;

  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
    <PageHeader title={editing ? "Edit item" : "Create item"} subtitle={editing ? item?.item_name : "Add an item to available inventory."} />
    <form onSubmit={submit} className="flex flex-col gap-5 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name"><Input required autoFocus value={form.item_name} onChange={(e) => { const item_name = e.target.value; setForm((current) => ({ ...current, item_name, category: inferCategory(item_name) })); }} /></Field>
        <Field label="Category"><div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">{form.category}</div></Field>
        {isAdmin && <Field label="Bought for"><Input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e) => setForm({ ...form, purchase_price: e.target.value })} /></Field>}
        <Field label="Asking price"><Input type="number" min="0" step="0.01" value={form.asking_price} onChange={(e) => setForm({ ...form, asking_price: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
      {editing && itemId && <PhotoGallery inventoryItemId={itemId} />}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-neutral-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => navigate(returnTo || (item?.package_id ? `/hauls/packages/${item.package_id}` : searchParams.get("packageId") ? `/hauls/packages/${searchParams.get("packageId")}` : "/hauls"))}>Back</Button>
        <Button type="submit" disabled={saving || !form.item_name.trim()}>{saving ? "Saving…" : "Save item"}</Button>
      </div>
    </form>
    {!editing && <p className="text-xs text-neutral-500">You can add photos after saving the item.</p>}
  </div>;
}
