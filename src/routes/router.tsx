import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RoleGate } from "@/components/auth/RoleGate";
import { AppLayout } from "@/components/layout/AppLayout";
import { SignInPage } from "@/pages/auth/SignInPage";
import { SignUpPage } from "@/pages/auth/SignUpPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { AvailablePage } from "@/pages/AvailablePage";
import { InventoryItemFormPage } from "@/pages/InventoryItemFormPage";
import { InventoryItemPage } from "@/pages/InventoryItemPage";
import { PackageDetailPage } from "@/pages/PackageDetailPage";
import { HaulsPage } from "@/pages/HaulsPage";
import { SoldPage } from "@/pages/SoldPage";
import { PostingPage } from "@/pages/PostingPage";
import { WalletPage } from "@/pages/WalletPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { ClosetPage } from "@/pages/ClosetPage";
import { TradesPage } from "@/pages/TradesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UnauthorizedPage } from "@/pages/UnauthorizedPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { useAuth } from "@/context/AuthContext";

function RootRoute() {
  const { loading, session, profile } = useAuth();
  if (loading) return <div className="p-6 text-sm text-neutral-500">Loading Dripseason-Office…</div>;
  return <Navigate to={session && profile?.role === "worker" ? "/hauls" : "/dashboard"} replace />;
}

function Page({ children, adminOnly }: { children: React.ReactNode; adminOnly?: boolean }) {
  const content = (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
  if (!adminOnly) return content;
  return (
    <ProtectedRoute>
      <RoleGate allow={["admin"]}>
        <AppLayout>{children}</AppLayout>
      </RoleGate>
    </ProtectedRoute>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRoute />} />

        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route path="/dashboard" element={<Page adminOnly><DashboardPage /></Page>} />
        <Route path="/available" element={<Page><AvailablePage /></Page>} />
        <Route path="/inventory" element={<Page><InventoryPage /></Page>} />
        <Route path="/inventory/new" element={<Page><InventoryItemFormPage /></Page>} />
        <Route path="/inventory/:itemId/edit" element={<Page><InventoryItemFormPage /></Page>} />
        <Route path="/inventory/:itemId" element={<Page><InventoryItemPage /></Page>} />
        <Route path="/hauls" element={<Page><HaulsPage /></Page>} />
        <Route path="/hauls/packages/:packageId" element={<Page><PackageDetailPage /></Page>} />
        <Route path="/sold" element={<Page><SoldPage /></Page>} />
        <Route path="/posting" element={<Page><PostingPage /></Page>} />
        <Route path="/closet" element={<Page><ClosetPage /></Page>} />
        <Route path="/trades" element={<Page><TradesPage /></Page>} />
        <Route path="/settings" element={<Page><SettingsPage /></Page>} />

        {/* Accounts is visible to BOTH roles (a worker needs to know which
            numbered account to post under) - the page itself hides the
            password column and the add/edit/delete controls for workers,
            backed by marketplace_accounts_secure + RLS in the database.
            Wallet is the one genuinely admin-only page, matching the
            original "workers see no income/revenue" rule. */}
        <Route path="/accounts" element={<Page><AccountsPage /></Page>} />
        <Route path="/wallet" element={<Page adminOnly><WalletPage /></Page>} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
