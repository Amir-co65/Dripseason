import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

export function Topbar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-3">
        {profile && (
          <span className="text-sm text-neutral-600">
            {profile.full_name ?? profile.email}{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                profile.role === "admin"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 text-neutral-700"
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
