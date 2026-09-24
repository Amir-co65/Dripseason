import type { ReactNode } from "react";

type BadgeTone = "neutral" | "good" | "bad" | "warn";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "border-neutral-300 text-neutral-600",
  good: "border-green-300 text-green-700 bg-green-50",
  bad: "border-red-300 text-red-700 bg-red-50",
  warn: "border-amber-300 text-amber-700 bg-amber-50",
};

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function StatCard({ label, value, tone }: { label: string; value: ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold sm:text-2xl ${
          tone === "good" ? "text-green-700" : tone === "bad" ? "text-red-600" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
      <p className="font-medium text-neutral-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm">{subtitle}</p>}
    </div>
  );
}
