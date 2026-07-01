import type { Route } from "next";
import Link from "next/link";
import { AgencySignupApplicationForm } from "@/components/agency/AgencySignupApplicationForm";

export const dynamic = "force-dynamic";

export default function AgencySignupPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Partner Sign-up</h1>
          <p>
            Apply for JHT partner portal access. The JHT admin team reviews each application before creating the mother
            account.
          </p>
        </div>
        <Link className="button-secondary" href={"/agency" as Route}>
          Back to Portal
        </Link>
      </div>
      <AgencySignupApplicationForm />
    </>
  );
}
