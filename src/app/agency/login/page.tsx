import type { Route } from "next";
import Link from "next/link";
import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";

export const dynamic = "force-dynamic";

export default function AgencyLoginPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Partner Log In</h1>
          <p>
            Overseas agency users sign in here to review public quotes, reservations, rooming lists, invoices, and
            workflow messages.
          </p>
        </div>
        <Link className="button-secondary" href={"/agency/signup" as Route}>
          Partner Sign-up
        </Link>
      </div>
      <SupabaseLoginForm buttonLabel="Log In" pendingLabel="Logging in..." redirectTo="/agency" />
    </>
  );
}
