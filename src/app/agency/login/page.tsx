import type { Route } from "next";
import Link from "next/link";
import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";
import { resolvePostLoginPath } from "@/lib/domain/auth-session.mjs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ next?: string; reset?: string }>;

export default async function AgencyLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const resetComplete = params.reset === "complete";
  const redirectTo = resolvePostLoginPath("agency", params.next);
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
        <div className="partner-auth-form-stack">
          {resetComplete ? <section className="notice compact"><p>Password updated. Log in with your new password.</p></section> : null}
          <SupabaseLoginForm accountType="agency" buttonLabel="Log In" pendingLabel="Logging in..." redirectTo={redirectTo} />
        </div>
      </section>
    </>
  );
}
