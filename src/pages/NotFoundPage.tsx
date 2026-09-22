import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-50 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/dashboard" className="text-sm font-medium underline">
        Back to dashboard
      </Link>
    </div>
  );
}
