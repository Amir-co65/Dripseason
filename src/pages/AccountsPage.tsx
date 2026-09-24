import { useState } from "react";
import { PageHeader, Badge, EmptyState } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import { TableScroll, Th, Td } from "@/components/ui/Table";
import { formatMoney } from "@/lib/format";
import { useCreateMarketplaceAccount, useCreatePostingAccount, useDeleteMarketplaceAccount, useDeletePostingAccount, useMarketplaceAccounts, usePostingAccounts, useUpdateMarketplaceAccount, useUpdatePostingAccount } from "@/hooks/useAccounts";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Database, Platform } from "@/types/database.types";

type Account = Database["public"]["Tables"]["marketplace_accounts"]["Row"];

export function AccountsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const { data: accounts, isLoading } = useMarketplaceAccounts();
  const { data: postingAccounts } = usePostingAccounts();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [postingForm, setPostingForm] = useState(false);
  const [editingPosting, setEditingPosting] = useState<any | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
  const del = useDeleteMarketplaceAccount();
  const deletePosting = useDeletePostingAccount();
  const [toDeletePosting, setToDeletePosting] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Accounts"
        subtitle={`${accounts?.length ?? 0} marketplace accounts`}
        actions={isAdmin ? <Button onClick={() => setAdding(true)}>+ Account</Button> : undefined}
      />

      {isLoading ? (
        <p className="text-sm text-neutral-400">Loading...</p>
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState title="No accounts yet" />
      ) : (
        <TableScroll>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Account</Th>
              <Th>Platform</Th>
              <Th>Email / username</Th>
              {isAdmin && <Th>Password</Th>}
              {isAdmin && <Th right>Balance</Th>}
              <Th>Status</Th>
              {isAdmin && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <Td>{a.posting_account_number ?? "—"}</Td>
                <Td className="font-medium">{a.label}</Td>
                <Td className="capitalize">{a.platform}</Td>
                <Td>
                  {a.email ?? "—"}
                  {a.username && <div className="text-xs text-neutral-400">{a.username}</div>}
                </Td>
                {isAdmin && <Td>{a.password ?? "—"}</Td>}
                {isAdmin && <Td right>{formatMoney(a.balance)}</Td>}
                <Td>{a.banned ? <Badge tone="bad">Banned</Badge> : <Badge tone="good">Active</Badge>}</Td>
                {isAdmin && (
                  <Td right>
                    <Button variant="ghost" onClick={() => setEditing(a as Account)}>Edit</Button>
                    <Button variant="ghost" onClick={() => setToDelete(a.id)}>
                      Delete
                    </Button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </TableScroll>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <PageHeader title="Posting accounts" subtitle="Numbered accounts used to track where each item is listed." actions={isAdmin ? <Button onClick={() => setPostingForm(true)}>+ Posting account</Button> : undefined} />
        {!postingAccounts?.length ? <p className="text-sm text-neutral-400">No posting accounts yet.</p> : <TableScroll><thead><tr><Th>Platform</Th><Th>Number</Th><Th>Account name</Th>{isAdmin && <Th></Th>}</tr></thead><tbody>{postingAccounts.map((account) => <tr key={account.id}><Td className="capitalize">{account.platform}</Td><Td>{account.account_number}</Td><Td>{account.display_name}</Td>{isAdmin && <Td right><Button variant="ghost" onClick={() => setEditingPosting(account)}>Edit</Button><Button variant="ghost" onClick={() => setToDeletePosting(account.id)}>Delete</Button></Td>}</tr>)}</tbody></TableScroll>}
      </section>

      {adding && <AccountFormModal onClose={() => setAdding(false)} />}
      {editing && <AccountFormModal account={editing} onClose={() => setEditing(null)} />}
      {postingForm && <PostingAccountForm onClose={() => setPostingForm(false)} />}
      {editingPosting && <PostingAccountForm account={editingPosting} onClose={() => setEditingPosting(null)} />}
      {toDeletePosting && <ConfirmDialog open title="Delete posting account" message="Remove this numbered account? Items will keep their posting status but lose the account link." confirmLabel="Delete" danger onCancel={() => setToDeletePosting(null)} onConfirm={async () => { await deletePosting.mutateAsync(toDeletePosting); setToDeletePosting(null); }} />}

      {toDelete && (
        <ConfirmDialog
          open
          title="Delete account"
          message="This can't be undone. Any items posted under it are unaffected."
          confirmLabel="Delete"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={async () => {
            await del.mutateAsync(toDelete);
            setToDelete(null);
          }}
        />
      )}
    </div>
  );
}

function PostingAccountForm({ account, onClose }: { account?: { id: string; platform: Platform; account_number: number; display_name: string }; onClose: () => void }) {
  const create = useCreatePostingAccount();
  const update = useUpdatePostingAccount();
  const [platform, setPlatform] = useState<Platform>(account?.platform ?? "vinted");
  const [number, setNumber] = useState(account ? String(account.account_number) : "");
  const [name, setName] = useState(account?.display_name ?? "");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      if (account) await update.mutateAsync({ id: account.id, input: { display_name: name } });
      else await create.mutateAsync({ platform, account_number: Number(number), display_name: name });
      onClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save posting account."); }
  }
  return <Modal open onClose={onClose} title={account ? "Edit posting account" : "New posting account"}><form onSubmit={submit} className="flex flex-col gap-4">
    {!account && <><Field label="Platform"><Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}><option value="vinted">Vinted</option><option value="plick">Plick</option></Select></Field><Field label="Account number"><Input type="number" min="1" required value={number} onChange={(e) => setNumber(e.target.value)} /></Field></>}
    <Field label="Account name"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? "Saving…" : "Save"}</Button></div>
  </form></Modal>;
}

function AccountFormModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const create = useCreateMarketplaceAccount();
  const update = useUpdateMarketplaceAccount();
  const [label, setLabel] = useState(account?.label ?? "");
  const [platform, setPlatform] = useState<Platform>(account?.platform ?? "vinted");
  const [postingNumber, setPostingNumber] = useState(account?.posting_account_number == null ? "" : String(account.posting_account_number));
  const [email, setEmail] = useState(account?.email ?? "");
  const [username, setUsername] = useState(account?.username ?? "");
  const [password, setPassword] = useState(account?.password ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
  const [balance, setBalance] = useState(account?.balance == null ? "0" : String(account.balance));
  const [notes, setNotes] = useState(account?.notes ?? "");
  const [banned, setBanned] = useState(account?.banned ?? false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const input = {
        label,
        platform,
        posting_account_number: postingNumber ? Number(postingNumber) : null,
        email: email || null,
        username: username || null,
        password: password || null,
        phone: phone || null,
        balance: Number(balance) || 0,
        notes: notes || null,
        banned,
      };
      if (account) await update.mutateAsync({ id: account.id, input });
      else await create.mutateAsync(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <Modal open onClose={onClose} title={account ? "Edit account" : "New account"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Label">
          <Input required value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Platform">
          <Select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="vinted">Vinted</option>
            <option value="plick">Plick</option>
          </Select>
        </Field>
        <Field label="Posting number">
          <Input type="number" value={postingNumber} onChange={(e) => setPostingNumber(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Username">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Balance"><Input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} /></Field>
        <Field label="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={banned} onChange={(e) => setBanned(e.target.checked)} /> Banned</label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
