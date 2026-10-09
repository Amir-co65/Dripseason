import { Link } from "react-router-dom";
import { EmptyState, StatCard } from "@/components/ui/Display";
import { useChapters, usePackages } from "@/hooks/useChapters";
import { useNonArrivingInventoryItems } from "@/hooks/useInventory";
import { useSales } from "@/hooks/useSales";
import { useWalletBalances } from "@/hooks/useWallet";
import { formatMoney } from "@/lib/format";

export function DashboardPage() {
  const { data: chapters = [] } = useChapters();
  const { data: packages = [] } = usePackages();
  const visiblePackages = packages.filter((pack) => pack.arrival_status !== "arriving");
  const { data: items = [] } = useNonArrivingInventoryItems();
  const { data: sales = [] } = useSales();
  const visibleItemIds = new Set(items.map((item) => item.id));
  const visibleSales = sales.filter((sale) => visibleItemIds.has(sale.inventory_item_id));
  const { data: balances = [] } = useWalletBalances();
  if (!chapters.length && !visibleSales.length && !items.length) return <EmptyState title="Welcome to Dripseason-Office" subtitle="Your workspace is empty. Import your backup to bring everything in, or start adding hauls, sales and accounts by hand." />;

  const itemById = new Map(items.map((item) => [item.id, item]));
  const moneySpent = items.reduce((total, item) => total + Number(item.purchase_price ?? 0), 0) + visiblePackages.reduce((total, item) => total + Number(item.shipping_cost ?? 0), 0);
  const moneyWon = visibleSales.reduce((total, sale) => total + Number(sale.sold_price ?? 0), 0);
  const estimatedMoneyWin = items.reduce((total, item) => total + Number(item.asking_price ?? 0), 0);
  const profit = moneyWon - moneySpent;
  const stockValue = items.filter((item) => item.status === "available").reduce((total, item) => total + Number(item.asking_price ?? 0), 0);
  const wallet = balances.reduce((total, balance) => total + balance.balance, 0);
  const months = new Map<string, number>();
  const places = new Map<string, number>();
  const categories = new Map<string, number>();
  for (const sale of visibleSales) {
    const price = Number(sale.sold_price ?? 0);
    if (sale.sale_date) months.set(sale.sale_date.slice(0, 7), (months.get(sale.sale_date.slice(0, 7)) ?? 0) + price);
    const place = sale.sale_platform || "Unknown";
    places.set(place, (places.get(place) ?? 0) + price);
    const category = itemById.get(sale.inventory_item_id)?.category || "Other";
    categories.set(category, (categories.get(category) ?? 0) + price);
  }
  const chapterProfit = chapters.map((chapter) => {
    const chapterPackages = visiblePackages.filter((item) => item.chapter_id === chapter.id);
    const ids = new Set(chapterPackages.map((item) => item.id));
    const chapterItems = items.filter((item) => item.package_id && ids.has(item.package_id));
    const spent = chapterItems.reduce((total, item) => total + Number(item.purchase_price ?? 0), 0) + chapterPackages.reduce((total, item) => total + Number(item.shipping_cost ?? 0), 0);
    const won = chapterItems.reduce((total, item) => total + Number(item.sold_price ?? 0), 0);
    return { name: chapter.name, itemCount: chapterItems.length, profit: won - spent };
  }).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const recentMonths = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8);

  return <div className="flex flex-col gap-4">
    <div><h1 className="text-2xl font-bold">Dashboard</h1><p className="mt-1 text-sm text-neutral-500">Overview of your reselling business · {sales.length.toLocaleString()} sales, {items.filter((item) => item.status === "available").length} items in stock</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><StatCard label="Money spent" value={formatMoney(moneySpent)} /><StatCard label="Money won" value={formatMoney(moneyWon)} /><StatCard label="Profit" value={formatMoney(profit)} tone={profit < 0 ? "bad" : "good"} /><StatCard label="Profit margin" value={moneyWon ? `${Math.round(profit / moneyWon * 1000) / 10}%` : "0%"} /><StatCard label="Stock value (asking)" value={formatMoney(stockValue)} /><StatCard label="Cash + balances" value={formatMoney(wallet)} /></div>
    <div className="grid gap-4 lg:grid-cols-2"><Panel title="Sales by month"><Bars rows={recentMonths.map(([label, value]) => ({ label, value }))} /></Panel><Panel title="Where you sell"><Breakdown rows={places} /></Panel><Panel title="Top categories · revenue"><Breakdown rows={categories} /></Panel><Panel title="Best chapters · profit">{chapterProfit.map((chapter) => <div key={chapter.name} className="flex justify-between border-b border-neutral-100 py-2 text-sm last:border-0"><span>{chapter.name} <span className="text-neutral-400">· {chapter.itemCount} items</span></span><span>{formatMoney(chapter.profit)}</span></div>) || <p className="text-sm text-neutral-400">—</p>}</Panel></div>
    <p className="text-sm text-neutral-500">Total sold-sheet revenue: <b>{formatMoney(moneyWon)}</b> · estimated sales: <b>{formatMoney(estimatedMoneyWin)}</b></p>
    <Link to="/hauls" className="text-sm text-neutral-500 hover:underline">Open Hauls</Link>
  </div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-neutral-200 bg-white p-4"><h2 className="mb-3 text-sm font-semibold">{title}</h2>{children}</section>; }
function Bars({ rows }: { rows: { label: string; value: number }[] }) { const max = Math.max(1, ...rows.map((item) => item.value)); return rows.length ? <div className="flex h-36 items-end gap-2">{rows.map((item) => <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1"><div title={`${item.label}: ${formatMoney(item.value)}`} className="w-full rounded-t bg-neutral-900" style={{ height: `${Math.max(2, item.value / max * 100)}%` }} /><span className="text-xs text-neutral-400">{item.label.slice(5)}</span></div>)}</div> : <p className="text-sm text-neutral-400">No dated sales yet.</p>; }
function Breakdown({ rows }: { rows: Map<string, number> }) { const sorted = [...rows.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6); const max = Math.max(1, ...sorted.map(([, value]) => value)); return sorted.length ? <div>{sorted.map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr_auto] items-center gap-2 py-1 text-sm"><span className="truncate">{label}</span><span className="h-1.5 overflow-hidden rounded bg-neutral-100"><i className="block h-full rounded bg-neutral-900" style={{ width: `${value / max * 100}%` }} /></span><span>{formatMoney(value)}</span></div>)}</div> : <p className="text-sm text-neutral-400">No sales yet.</p>; }
