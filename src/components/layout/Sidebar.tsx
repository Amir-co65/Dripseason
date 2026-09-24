import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";

export type IconName = "dashboard" | "hauls" | "available" | "sold" | "posting" | "accounts" | "closet" | "trades" | "wallet" | "settings";

const paths: Record<IconName, ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  hauls: <><path d="M3 7h18l-1.5 13h-15L3 7Z" /><path d="M8 9V6a4 4 0 0 1 8 0v3" /></>,
  available: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4.5 7.7 7.5 4.4 7.5-4.4M12 12v9" /></>,
  sold: <><path d="M4 12.5 9.5 18 20 6" /><circle cx="12" cy="12" r="9" /></>,
  posting: <><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4 18-7Z" /></>,
  accounts: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  closet: <><path d="M4 21h16M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M12 3v18M10 8h.01M14 8h.01" /></>,
  trades: <><path d="M7 7h13l-3-3M17 17H4l3 3" /><path d="M20 7v5M4 17v-5" /></>,
  wallet: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 9h18M16 14h2" /><path d="M6 5V3h12v2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 2Z" transform="translate(-1 -1) scale(1.08)" /></>,
};

export function NavIcon({ name }: { name: IconName }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navItems: { to: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", adminOnly: true },
  { to: "/hauls", label: "Hauls", icon: "hauls" },
  { to: "/available", label: "Available", icon: "available" },
  { to: "/sold", label: "Sold", icon: "sold" },
  { to: "/posting", label: "Posting", icon: "posting" },
  { to: "/accounts", label: "Accounts", icon: "accounts" },
  { to: "/closet", label: "Closet", icon: "closet" },
  { to: "/trades", label: "Trades", icon: "trades" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, user } = useAuth();
  const compact = user?.user_metadata?.project26_ui && typeof user.user_metadata.project26_ui === "object" && (user.user_metadata.project26_ui as { sidebar?: string }).sidebar === "compact";
  const linkClasses = ({ isActive }: { isActive: boolean }) => `flex items-center rounded-lg py-2 text-sm font-medium transition ${compact ? "justify-center px-0" : "gap-3 px-3"} ${isActive ? "bg-[var(--p26-accent)] text-white" : "text-neutral-600 hover:bg-neutral-100"}`;
  const link = (to: string, label: string, icon: IconName) => (
    <NavLink key={to} to={to} title={compact ? label : undefined} aria-label={label} className={linkClasses} onClick={onNavigate}>
      <NavIcon name={icon} />{!compact && <span>{label}</span>}
    </NavLink>
  );

  return (
    <aside className={`flex h-full flex-col gap-1 overflow-y-auto border-r border-neutral-200 bg-white p-3 transition-[width] duration-200 ${compact ? "w-[4.5rem]" : "w-64"}`}>
      <div className={`mb-4 flex h-11 items-center ${compact ? "justify-center" : "gap-3 px-2"}`}>
        <img src="/dripseason-office-logo.jpeg" alt="Dripseason-Office logo" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        {!compact && <span className="text-sm font-bold tracking-tight text-neutral-900">Dripseason-Office</span>}
      </div>

      {navItems.filter((item) => !item.adminOnly || profile?.role === "admin").map((item) => link(item.to, item.label, item.icon))}

      {profile?.role === "admin" && <div className="mt-4 border-t border-neutral-200 pt-4">
        {!compact && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Admin</p>}
        {link("/wallet", "Wallet", "wallet")}
      </div>}

      <div className="mt-4 border-t border-neutral-200 pt-4">{link("/settings", "Settings", "settings")}</div>
    </aside>
  );
}
