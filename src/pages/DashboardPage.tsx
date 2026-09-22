import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/Card";

export function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="text-neutral-500">
          You're signed in as <span className="font-medium">{profile?.role}</span>.
        </p>
      </div>

      <Card>
        <h2 className="mb-2 font-semibold">This is just the foundation</h2>
        <p className="text-sm text-neutral-600">
          Authentication, roles, and the database security rules are all wired up and
          working. Inventory features (hauls, sold items, accounts, and so on) haven't
          been built yet on this new stack - that's the next phase, once this foundation
          is confirmed solid.
        </p>
      </Card>
    </div>
  );
}
