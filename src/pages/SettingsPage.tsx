import { useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/Display";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { applyProject26Ui, readProject26Ui, type Project26Ui } from "@/lib/project26Ui";
import { importLegacyBackup, type ImportSummary } from "@/services/importLegacyBackup";

const accents: { value: Project26Ui["accent"]; color: string; label: string }[] = [
  { value: "mono", color: "#1a1a19", label: "Mono" }, { value: "blue", color: "#2f5bea", label: "Blue" }, { value: "green", color: "#1a7f4b", label: "Green" }, { value: "orange", color: "#d9541e", label: "Orange" }, { value: "purple", color: "#7a4fe0", label: "Purple" }, { value: "rose", color: "#d6336c", label: "Rose" },
];

export function SettingsPage() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === "admin";
  const [ui, setUi] = useState(() => readProject26Ui(user?.user_metadata?.project26_ui));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(next: Project26Ui) { setUi(next); applyProject26Ui(next); setSaving(true); setError(null); const { error: updateError } = await supabase.auth.updateUser({ data: { project26_ui: next } }); if (updateError) setError(updateError.message); setSaving(false); }
  function set<K extends keyof Project26Ui>(key: K, value: Project26Ui[K]) { void save({ ...ui, [key]: value }); }

  return <div className="p26-page flex flex-col gap-6">
    <PageHeader title="Settings" subtitle={isAdmin ? "Make the app yours, and take your data with you" : "Make the app yours"} />
    <section className="rounded-[var(--p26-radius)] border border-neutral-200 bg-white p-5"><h2 className="mb-4 font-semibold">Appearance</h2>
      <Setting label="Theme" hint="Follows your device by default"><Segment value={ui.theme} options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={(v) => set("theme", v as Project26Ui["theme"])} /></Setting>
      <Setting label="Accent color"><div className="flex gap-3">{accents.map((accent) => <button key={accent.value} type="button" title={accent.label} aria-label={accent.label} onClick={() => set("accent", accent.value)} className={`h-6 w-6 rounded-full border-2 border-white outline ${ui.accent === accent.value ? "outline-2 outline-neutral-950" : "outline-neutral-300"}`} style={{ background: accent.color }} />)}</div></Setting>
      <Setting label="Density"><Segment value={ui.density} options={[["comfortable", "Comfortable"], ["compact", "Compact"]]} onChange={(v) => set("density", v as Project26Ui["density"])} /></Setting>
      <Setting label="Text size"><Segment value={ui.fontSize} options={[["small", "Small"], ["normal", "Normal"], ["large", "Large"]]} onChange={(v) => set("fontSize", v as Project26Ui["fontSize"])} /></Setting>
      <Setting label="Corners"><Segment value={ui.radius} options={[["round", "Rounded"], ["sharp", "Sharp"]]} onChange={(v) => set("radius", v as Project26Ui["radius"])} /></Setting>
      <Setting label="Sidebar"><Segment value={ui.sidebar} options={[["expanded", "Expanded"], ["compact", "Icons only"]]} onChange={(v) => set("sidebar", v as Project26Ui["sidebar"])} /></Setting>
      <Setting label="Currency symbol" hint="Shown before every amount"><Input className="max-w-24" value={ui.currency} maxLength={3} onChange={(event) => setUi({ ...ui, currency: event.target.value })} onBlur={() => void save(ui)} /></Setting>
      <Setting label="Hide sensitive account details" hint="Emails, usernames, passwords and phones stay masked until you reveal them"><Segment value={String(ui.maskSensitive)} options={[["true", "On"], ["false", "Off"]]} onChange={(v) => set("maskSensitive", v === "true")} /></Setting>
      {saving && <p className="mt-3 text-sm text-neutral-500">Saving settings…</p>}{error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
    <section className="rounded-[var(--p26-radius)] border border-neutral-200 bg-white p-5"><h2 className="mb-3 font-semibold">Your account</h2><dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"><div><dt className="text-neutral-400">Name</dt><dd>{profile?.full_name ?? "—"}</dd></div><div><dt className="text-neutral-400">Email</dt><dd>{profile?.email ?? "—"}</dd></div><div><dt className="text-neutral-400">Role</dt><dd className="capitalize">{profile?.role ?? "—"}</dd></div></dl></section>
    {isAdmin && <ImportLegacyBackupCard />}
  </div>;
}

function Setting({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) { return <div className="flex flex-col justify-between gap-3 border-t border-neutral-100 py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center"><div><div className="font-medium">{label}</div>{hint && <small className="text-neutral-500">{hint}</small>}</div>{children}</div>; }
function Segment({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) { return <div className="inline-flex overflow-hidden rounded-[var(--p26-radius)] border border-neutral-300">{options.map(([option, label]) => <button key={option} type="button" onClick={() => onChange(option)} className={`border-r border-neutral-300 px-3 py-1.5 text-sm last:border-r-0 ${value === option ? "bg-[var(--p26-accent)] text-[var(--p26-accent-fg)]" : "bg-white"}`}>{label}</button>)}</div>; }
function ImportLegacyBackupCard() { const fileRef = useRef<HTMLInputElement>(null); const [running, setRunning] = useState(false); const [log, setLog] = useState<string[]>([]); const [summary, setSummary] = useState<ImportSummary | null>(null); const [error, setError] = useState<string | null>(null); async function handleFile(file: File) { setRunning(true); setError(null); setSummary(null); setLog([]); try { const result = await importLegacyBackup(JSON.parse(await file.text()), (message) => setLog((prev) => [...prev.slice(-9), message])); setSummary(result); } catch (err) { setError(err instanceof Error ? err.message : "Import failed"); } finally { setRunning(false); if (fileRef.current) fileRef.current.value = ""; } } return <section className="rounded-[var(--p26-radius)] border border-neutral-200 bg-white p-5"><h2 className="mb-1 font-semibold">Import backup</h2><p className="mb-4 text-sm text-neutral-500">Upload a Project26 backup. The importer preserves the original chapter, package, item, sale, account, closet, trade, link, and photo records in Supabase.</p><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} /><Button onClick={() => fileRef.current?.click()} disabled={running}>{running ? "Importing…" : "Choose backup file…"}</Button>{log.length > 0 && <div className="mt-4 rounded bg-neutral-50 p-3 font-mono text-xs text-neutral-600">{log.map((line, index) => <div key={index}>{line}</div>)}</div>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}{summary && <p className="mt-4 text-sm text-green-700">Import complete: {summary.items} items, {summary.sales} sales, {summary.photosUploaded} photos, {summary.links} links.</p>}</section>; }
