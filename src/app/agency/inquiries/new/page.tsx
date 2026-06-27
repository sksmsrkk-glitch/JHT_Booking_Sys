import type { Route } from "next";
import Link from "next/link";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

const inquiriesRoute = "/agency/inquiries" as Route;

export default async function AgencyNewInquiryPage() {
  const { authorization } = await getPageAuthorization();

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

      {!authorization ? (
        <section className="notice warning">
          <h2>Agency login required</h2>
          <p>This page submits through the Agency API, which requires an active agency user JWT.</p>
        </section>
      ) : null}

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
