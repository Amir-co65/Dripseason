import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/types/database.types";
import { Spinner } from "@/components/ui/Spinner";

interface RoleGateProps {
  allow: UserRole[];
  children: ReactNode;
  /** If false (default), a mismatched role redirects to /unauthorized.
   * If true, it just renders nothing - useful for hiding a nav link. */
  silent?: boolean;
}

/**
 * Use this INSIDE an already-protected page/section to further restrict it
 * by role, e.g. <RoleGate allow={['admin']}> ...admin-only UI... </RoleGate>.
 *
 * Same caveat as ProtectedRoute: this is a UI convenience, not real
 * security. The database's Row Level Security policies are what actually
 * stop a worker from reading admin-only data, no matter what the UI shows.
 */
export function RoleGate({ allow, children, silent = false }: RoleGateProps) {
  const { profile, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!profile) return silent ? null : <Navigate to="/sign-in" replace />;

  if (!allow.includes(profile.role)) {
    return silent ? null : <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
