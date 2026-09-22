import { NavLink } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm font-medium ${
    isActive ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
  }`;

export function Sidebar() {
  const { profile } = useAuth();

  return (
    <aside className="flex h-full w-60 flex-col gap-1 border-r border-neutral-200 bg-white p-4">
      <div className="mb-4 px-2 text-lg font-bold">Project26</div>

      <NavLink to="/dashboard" className={linkClasses}>
        Dashboard
      </NavLink>

      {/*
        This is the pattern for every future admin-only nav link: check
        profile.role before rendering it at all, so a worker never even
        sees a link that would just bounce them to /unauthorized. The
        matching page itself should ALSO be wrapped in <RoleGate> (see
        routes/router.tsx) - this hides the link, RoleGate protects the page.
        No admin-only pages exist yet - inventory/accounts/etc. come later -
        this is just here to show the pattern in place from day one.
      */}
      {profile?.role === "admin" && (
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <p className="mb-1 px-2 text-xs font-semibold uppercase text-neutral-400">
            Admin
          </p>
          <p className="px-2 text-sm text-neutral-400">
            (Admin-only sections will appear here)
          </p>
        </div>
      )}
    </aside>
  );
}
