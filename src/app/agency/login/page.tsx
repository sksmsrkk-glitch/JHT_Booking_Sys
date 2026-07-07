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
      <section className="partner-auth-layout">
        <div className="partner-auth-copy">
          <h2>Partner account access</h2>
          <p>
            Use the account approved by JHT. All quotes, reservations, invoices, and communication are filtered by your
            agency profile after sign-in.
          </p>
          <ul>
            <li>Mother ID can manage agency-side sub users.</li>
            <li>Inactive or frozen accounts cannot access partner records.</li>
            <li>Internal costs and supplier details remain hidden.</li>
          </ul>
        </div>
        <SupabaseLoginForm buttonLabel="Log In" pendingLabel="Logging in..." redirectTo="/agency" />
      </section>
    </>
  );
}
