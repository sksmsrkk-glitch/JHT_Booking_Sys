import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyInquirySummary } from "@/features/agency/types";
import { InquiryCreateForm } from "@/components/agency/InquiryCreateForm";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; inquiries: AgencyInquirySummary[]; isPreview?: boolean }
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

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed during development, so this list shows sample inquiry workflow rows.</p>
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
            <th>Tour Code</th>
            <th>Title</th>
            <th>Type</th>
            <th>Submitted</th>
            <th>Period</th>
            <th>Pax</th>
            <th>Tour Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {inquiries.map((inquiry) => (
            <tr key={inquiry.id}>
              <td>{(inquiry as any).tourCode ?? "-"}</td>
              <td>{inquiry.title}</td>
              <td>{formatLabel(inquiry.inquiryType)}</td>
              <td>{inquiry.createdAt.slice(0, 10)}</td>
              <td>{(inquiry as any).periodText ?? formatDateRange(inquiry.requestedStartDate, inquiry.requestedEndDate)}</td>
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
      status: "ready",
      inquiries: demoAgencyInquiries,
      isPreview: true
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/inquiries", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "ready" : "error",
      ...(response.status === 401 || response.status === 403 ? { inquiries: demoAgencyInquiries, isPreview: true } : {}),
      message: payload.error ?? "Unknown inquiry API error"
    } as LoadState;
  }

  const inquiries = (payload.data ?? []).map((row: any) => ({
    id: row.id,
    tourCode: row.tour_code ?? row.request_payload?.tourCode ?? null,
    inquiryType: row.inquiry_type,
    title: row.title,
    requestedStartDate: row.requested_start_date ?? null,
    requestedEndDate: row.requested_end_date ?? null,
    periodText: row.period_text ?? row.request_payload?.periodText ?? null,
    paxCount: row.pax_count ?? null,
    tourType: row.tour_type ?? null,
    status: row.status,
    createdAt: row.created_at
  }));

  return { status: "ready", inquiries };
}

const demoAgencyInquiries = [
  {
    id: "preview-inquiry-new",
    tourCode: "MY-WORLDTRAV-20260629",
    inquiryType: "new_inquiry",
    title: "MHDM Seoul 4N group",
    requestedStartDate: "2026-03-24",
    requestedEndDate: "2026-03-28",
    periodText: "24-28 Mar 2026 / 4 nights",
    paxCount: 26,
    tourType: "incentive_tour",
    status: "new",
    createdAt: "2026-06-29T09:00:00+09:00"
  },
  {
    id: "preview-inquiry-revision",
    tourCode: "MY-WORLDTRAV-20260629",
    inquiryType: "revision_request",
    title: "MHDM Seoul 4N group - hotel/date change",
    requestedStartDate: null,
    requestedEndDate: null,
    periodText: "Change from 4N to 5N, move start date to September",
    paxCount: 26,
    tourType: "incentive_tour",
    status: "reviewing",
    createdAt: "2026-06-29T10:00:00+09:00"
  }
] as any[];

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
