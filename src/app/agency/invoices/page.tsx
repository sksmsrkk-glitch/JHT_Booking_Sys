import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyInvoiceListItem } from "@/features/agency-portal/types";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; invoices: AgencyInvoiceListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;

export default async function AgencyInvoicesPage() {
  const loadState = await loadInvoices();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Invoices</h1>
          <p>
            Review issued invoice and payment summaries for your agency-owned reservations.
          </p>
        </div>
        <Link className="button-secondary" href={agencyRoute}>
          Back to Portal
        </Link>
      </div>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Agency login required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Invoices could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <InvoiceTable invoices={loadState.invoices} /> : null}

      <section className="notice">
        <h2>Invoice boundary</h2>
        <ul className="clean-list">
          <li>Only issued, partially paid, paid, and overdue invoices are shown.</li>
          <li>Payments are summarized read-only.</li>
          <li>Expenses, shopping commissions, and settlements are not queried.</li>
        </ul>
      </section>
    </>
  );
}

function InvoiceTable({ invoices }: { invoices: AgencyInvoiceListItem[] }) {
  if (invoices.length === 0) {
    return (
      <section className="empty-state">
        <h2>No invoices yet</h2>
        <p>Issued invoices from JHT will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Agency invoices">
      <table>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Reservation</th>
            <th>Status</th>
            <th>Total</th>
            <th>Paid</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td>
                <Link className="strong-link" href={`/agency/invoices/${invoice.id}` as Route}>
                  {invoice.invoiceNo}
                </Link>
                {invoice.storagePath ? <span className="subtext">File ready</span> : null}
              </td>
              <td>
                {invoice.reservationCode ?? invoice.reservationId}
                {invoice.tourName ? <span className="subtext">{invoice.tourName}</span> : null}
              </td>
              <td>
                <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
              </td>
              <td>
                {invoice.currency} {invoice.totalAmount.toLocaleString()}
              </td>
              <td>
                {invoice.currency} {invoice.confirmedPaymentTotal.toLocaleString()}
                <span className="subtext">{invoice.paymentCount} payments</span>
              </td>
              <td>{invoice.dueDate ?? "Not set"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadInvoices(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads invoices through the Agency API, which requires an active agency user JWT."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/invoices", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown invoice API error"
    };
  }

  return { status: "ready", invoices: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
