import type { Route } from "next";
import Link from "next/link";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";

export const dynamic = "force-dynamic";

const inquiriesRoute = "/agency/inquiries" as Route;

export default async function AgencyNewInquiryPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>New Inquiry</h1>
          <p>Create a new agency-scoped inquiry without exposing internal cost or supplier data.</p>
        </div>
        <Link className="button-secondary" href={inquiriesRoute}>
          Back to Inquiries
        </Link>
      </div>

      <section className="notice">
        <h2>Development preview mode</h2>
        <p>Agency login is bypassed while this portal is being designed and tested. Submitted preview inquiries return a tour code.</p>
      </section>

      <InquiryCreateForm />

      <section className="notice">
        <h2>Inquiry boundary</h2>
        <ul className="clean-list">
          <li>New inquiries are created only for the signed-in agency account.</li>
          <li>Booking and revision requests remain separate audited actions on quote detail pages.</li>
          <li>Domestic Supplier costs, quote items, and internal finance records are not queried here.</li>
        </ul>
      </section>
    </>
  );
}
