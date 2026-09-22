import { Link } from "react-router-dom";

export function UnauthorizedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-50 text-center">
      <h1 className="text-2xl font-bold">You don't have access to this page</h1>
      <p className="text-neutral-500">Your account role doesn't allow this.</p>
      <Link to="/dashboard" className="text-sm font-medium underline">
        Back to dashboard
      </Link>
    </div>
  );
}
