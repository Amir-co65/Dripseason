import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Sign-up flow, in two steps:
 *  1. Create the account normally (email + password + name). This always
 *     creates a 'worker' - see handle_new_user() in the migrations for why.
 *  2. Optionally, if they were given an admin code, claim the admin role
 *     right after - this calls claim_admin_role() which checks the code
 *     inside the database, never in this component.
 */
export function SignUpPage() {
  const { signUp, claimAdminRole } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<"signup" | "admin-code">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [wantsAdmin, setWantsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signUp(email, password, fullName);
    setSubmitting(false);

    if (error) {
      setError(error);
      return;
    }

    if (wantsAdmin) {
      setStep("admin-code");
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  async function handleClaimAdmin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { success } = await claimAdminRole(adminCode);
    setSubmitting(false);

    if (!success) {
      setError("That code isn't correct. You can still continue as a worker.");
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  if (step === "admin-code") {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <Card className="w-full max-w-sm">
          <div className="mb-5 flex items-center gap-3"><img src="/dripseason-office-logo.jpeg" alt="" className="h-12 w-12 rounded-full object-cover" /><span className="text-base font-bold tracking-tight text-neutral-900">Dripseason-Office</span></div>
          <h1 className="mb-1 text-xl font-bold">Enter your admin code</h1>
          <p className="mb-6 text-sm text-neutral-500">
            Your account was created as a worker. Enter the admin code to upgrade it now.
          </p>

          <form onSubmit={handleClaimAdmin} className="flex flex-col gap-4">
            <input
              type="password"
              required
              autoFocus
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="Admin code"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Checking..." : "Confirm"}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/dashboard", { replace: true })}
              className="text-sm text-neutral-500 underline"
            >
              Skip and continue as worker
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <Card className="w-full max-w-sm">
        <div className="mb-5 flex items-center gap-3"><img src="/dripseason-office-logo.jpeg" alt="" className="h-12 w-12 rounded-full object-cover" /><span className="text-base font-bold tracking-tight text-neutral-900">Dripseason-Office</span></div>
        <h1 className="mb-1 text-xl font-bold">Create an account</h1>
        <p className="mb-6 text-sm text-neutral-500">Get started with Dripseason-Office.</p>

        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Full name</span>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={wantsAdmin}
              onChange={(e) => setWantsAdmin(e.target.checked)}
            />
            I have an admin code
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link to="/sign-in" className="font-medium text-neutral-900 underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
