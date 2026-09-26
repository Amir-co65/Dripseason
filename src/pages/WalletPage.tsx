import { useState } from "react";
import { PageHeader } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input } from "@/components/ui/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { useAddWalletTransaction, useWalletBalances } from "@/hooks/useWallet";
import { useMarketplaceAccounts } from "@/hooks/useAccounts";
import type { WalletBucket } from "@/types/database.types";
import { usePlatforms } from "@/hooks/usePlatforms";

export function WalletPage() {
  const { data: balances } = useWalletBalances();
  const { data: accounts } = useMarketplaceAccounts();
  const { data: platforms = [] } = usePlatforms();
  const [adjusting, setAdjusting] = useState<{ bucket: WalletBucket; direction: "add" | "take" } | null>(null);
  const [settingBucket, setSettingBucket] = useState<WalletBucket | null>(null);

  const total = (balances ?? []).reduce((sum, b) => sum + b.balance, 0);
  const updatedAt = [...(balances ?? [])].map((balance) => balance.updated_at).sort().at(-1);
  const balanceByBucket = new Map((balances ?? []).map((balance) => [balance.bucket, balance]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Wallet" subtitle={`Total ${formatMoney(total)} · updated ${formatDate(updatedAt)}`} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {["cash", ...platforms.map((platform) => platform.slug)].map((bucket) => {
          const balance = balanceByBucket.get(bucket)?.balance ?? 0;
          return <div key={bucket} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-xs capitalize text-neutral-500">{bucket}</div>
            <div className="mt-1 text-xl font-semibold sm:text-2xl">{formatMoney(balance)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="flex-1" variant="secondary" onClick={() => setAdjusting({ bucket, direction: "add" })}>+ Add</Button>
              <Button className="flex-1" variant="secondary" onClick={() => setAdjusting({ bucket, direction: "take" })}>− Take</Button>
              <Button className="flex-1" variant="ghost" onClick={() => setSettingBucket(bucket)}>Set</Button>
            </div>
          </div>;
        })}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Balances held in marketplace accounts</h2>
        <div className="mt-2 divide-y divide-neutral-100 text-sm">
          {platforms.map((platformRow) => {
            const platform = platformRow.slug;
            const platformAccounts = (accounts ?? []).filter((account) => account.platform === platform);
            const held = platformAccounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
            return <div key={platform} className="flex justify-between py-2"><span className="capitalize">{platform} <span className="text-neutral-400">· {platformAccounts.length} accounts</span></span><span className="font-medium">{formatMoney(held)}</span></div>;
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-500">Per-account balances are edited on the Accounts page. The wallet above is your manual tracker.</p>
      </div>

      {adjusting && <AdjustmentModal bucket={adjusting.bucket} direction={adjusting.direction} onClose={() => setAdjusting(null)} />}
      {settingBucket && <SetBalanceModal bucket={settingBucket} current={balanceByBucket.get(settingBucket)?.balance ?? 0} onClose={() => setSettingBucket(null)} />}
    </div>
  );
}

function SetBalanceModal({ bucket, current, onClose }: { bucket: WalletBucket; current: number; onClose: () => void }) {
  const add = useAddWalletTransaction();
  const [amount, setAmount] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const delta = Number(amount) - current;
    if (!Number.isFinite(delta)) { setError("Enter a valid balance."); return; }
    if (delta === 0) { onClose(); return; }
    try {
      await add.mutateAsync({ bucket, amount: delta, reason: "Set balance" });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update balance."); }
  }
  return <Modal open onClose={onClose} title={`Set ${bucket} balance`}>
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="New balance"><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={add.isPending}>{add.isPending ? "Saving…" : "Set balance"}</Button></div>
    </form>
  </Modal>;
}

function AdjustmentModal({ bucket, direction, onClose }: { bucket: WalletBucket; direction: "add" | "take"; onClose: () => void }) {
  const add = useAddWalletTransaction();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const signedAmount = (direction === "add" ? 1 : -1) * Math.abs(Number(amount) || 0);
      await add.mutateAsync({ bucket, amount: signedAmount, reason: direction === "add" ? "Wallet add" : "Wallet take" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title={`${direction === "add" ? "Add to" : "Take from"} ${bucket}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Amount to adjust">
          <Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={add.isPending}>
            {add.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
