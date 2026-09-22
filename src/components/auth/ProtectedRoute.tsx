import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Wrap any page that requires someone to be logged in. If they're not,
 * they're bounced to /sign-in - and we remember where they were trying to
 * go, so we can send them back there right after they log in.
 *
 * IMPORTANT: this only controls what the React app *shows*. The real
 * security is the Row Level Security policies in the database - even if
 * someone bypassed this component entirely, the database itself would
 * refuse to hand back data they're not allowed to see. Never rely on the
 * frontend alone to protect real data.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session..." />;

  if (!session) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
