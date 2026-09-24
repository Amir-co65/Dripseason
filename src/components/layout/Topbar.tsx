import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, signOut } = useAuth();

  return (
    <header className="flex h-14 flex-none items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      <div className="flex items-center gap-2 md:hidden">
        <img src="/dripseason-office-logo.jpeg" alt="" className="h-8 w-8 rounded-full object-cover" />
        <span className="text-sm font-bold tracking-tight text-neutral-900">Dripseason-Office</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        {profile && (
          <span className="hidden text-sm text-neutral-600 sm:inline">
            {profile.full_name ?? profile.email}{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                profile.role === "admin" ? "bg-neutral-900 text-white" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {profile.role}
            </span>
          </span>
        )}
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
