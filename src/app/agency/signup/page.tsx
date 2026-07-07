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
      <section className="partner-onboarding-steps" aria-label="Partner onboarding steps">
        <div>
          <span>01</span>
          <strong>Submit application</strong>
          <p>Enter company, country, contact, email, and business notes.</p>
        </div>
        <div>
          <span>02</span>
          <strong>JHT review</strong>
          <p>Internal admin approves or rejects the partner application.</p>
        </div>
        <div>
          <span>03</span>
          <strong>Mother account</strong>
          <p>Approved partners receive portal access and can manage sub users.</p>
        </div>
      </section>
      <AgencySignupApplicationForm />
    </>
  );
}
