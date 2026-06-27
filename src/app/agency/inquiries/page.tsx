import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyInquirySummary } from "@/features/agency/types";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; inquiries: AgencyInquirySummary[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;

export default async function AgencyInquiriesPage() {
  const loadState = await loadInquiries();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Inquiries</h1>
          <p>
            Create and track agency-owned inquiries, revision requests, booking requests,
            changes, and cancellations through agency-scoped RLS.
          </p>
        </div>
        <Link className="button-secondary" href={agencyRoute}>
          Back to Portal
        </Link>
      </div>

      <section className="action-band">
        <div>
          <h2>New Inquiry</h2>
          <p>Use the dedicated form page when you want a focused inquiry submission workflow.</p>
        </div>
        <Link className="button-primary" href={"/agency/inquiries/new" as Route}>
          Create Inquiry
        </Link>
      </section>

      <InquiryCreateForm />

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Agency login required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Inquiries could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <InquiryTable inquiries={loadState.inquiries} /> : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Agency users can read and create inquiries only for their own agency account.</li>
          <li>Booking requests do not grant direct reservation write access.</li>
          <li>Domestic Supplier prices, quote items, operation tasks, and settlements are not queried here.</li>
        </ul>
      </section>
    </>
  );
}

function InquiryTable({ inquiries }: { inquiries: AgencyInquirySummary[] }) {
  if (inquiries.length === 0) {
    return (
      <section className="empty-state">
        <h2>No inquiries yet</h2>
        <p>New inquiries and booking requests will appear here after submission.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Agency inquiries">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Type</th>
            <th>Dates</th>
            <th>Pax</th>
            <th>Tour Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inquiry) => (
            <tr key={inquiry.id}>
              <td>{inquiry.title}</td>
              <td>{formatLabel(inquiry.inquiryType)}</td>
              <td>{formatDateRange(inquiry.requestedStartDate, inquiry.requestedEndDate)}</td>
              <td>{inquiry.paxCount ?? "Not set"}</td>
              <td>{inquiry.tourType ? formatLabel(inquiry.tourType) : "Not set"}</td>
              <td>{inquiry.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadInquiries(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads inquiries through the Agency API, which requires an active agency user JWT."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/inquiries", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown inquiry API error"
    };
  }

  const inquiries = (payload.data ?? []).map((row: any) => ({
    id: row.id,
    inquiryType: row.inquiry_type,
    title: row.title,
    requestedStartDate: row.requested_start_date ?? null,
    requestedEndDate: row.requested_end_date ?? null,
    paxCount: row.pax_count ?? null,
    tourType: row.tour_type ?? null,
    status: row.status,
    createdAt: row.created_at
  }));

  return { status: "ready", inquiries };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
