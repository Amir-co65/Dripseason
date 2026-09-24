import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { NavIcon, Sidebar, type IconName } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export function AppLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile } = useAuth();
  const mobileTabs: { to: string; label: string; icon: IconName }[] = profile?.role === "worker"
    ? [{ to: "/hauls", label: "Hauls", icon: "hauls" }, { to: "/available", label: "Stock", icon: "available" }, { to: "/sold", label: "Sold", icon: "sold" }, { to: "/posting", label: "Posting", icon: "posting" }]
    : [{ to: "/dashboard", label: "Home", icon: "dashboard" }, { to: "/hauls", label: "Hauls", icon: "hauls" }, { to: "/available", label: "Stock", icon: "available" }, { to: "/sold", label: "Sold", icon: "sold" }];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-50">
      {/* Desktop/tablet: sidebar is always visible */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Phone: sidebar becomes a slide-over drawer, opened from the Topbar */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-auto p-4 pb-24 sm:p-6">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white px-1 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Primary navigation">
        {mobileTabs.map((tab) => <NavLink key={tab.to} to={tab.to} className={({ isActive }) => `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs ${isActive ? "font-semibold text-[var(--p26-accent)]" : "text-neutral-500"}`}>
          <NavIcon name={tab.icon} /><span>{tab.label}</span>
        </NavLink>)}
        <button type="button" onClick={() => setDrawerOpen(true)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs text-neutral-500"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg><span>More</span></button>
      </nav>
    </div>
  );
}
