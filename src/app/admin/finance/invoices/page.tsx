import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { INVOICE_STATUSES } from "@/features/finance/queries";
import type { InvoiceListItem } from "@/features/finance/types";
import { demoFinanceInvoices } from "@/features/finance/demo-invoices";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
}>;

type LoadState =
  | { status: "ready"; invoices: InvoiceListItem[]; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const settlementsRoute = "/admin/finance/settlements" as Route;

export default async function AdminFinancePage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadInvoices(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Finance</h1>
          <p>
            Invoice, payment, expense, shopping commission, and settlement workspace for
            finance/admin users.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/finance/invoices">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Invoice number" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="action-band">
        <div>
          <h2>High-Risk Finance Controls</h2>
          <p>
            Invoice issuance, payment confirmation, and settlement approval must be
            finance/admin-gated and audit logged before production use.
          </p>
        </div>
        <span className="status-dot status-live">Finance Gated</span>
        <Link className="button-secondary" href={settlementsRoute}>
          Settlements
        </Link>
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Finance role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Finance login is bypassed during development, so this page shows an invoice workflow sample.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Finance data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <InvoiceTable invoices={loadState.invoices} /> : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Finance writes require finance/admin role.</li>
          <li>Expenses, shopping commissions, and settlements are not Agency-visible.</li>
          <li>Payment idempotency keys and settlement approvals protect high-risk actions.</li>
        </ul>
      </section>
    </>
  );
}

function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) {
    return (
      <section className="empty-state">
        <h2>No invoices found</h2>
        <p>Invoices will appear here after reservations are ready for billing.</p>
      </section>
    );
  }

  const totalIssued = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + invoice.confirmedPaymentTotal, 0);

  return (
    <>
      <section className="metric-row">
        <article className="metric-card">
          <span>Invoices</span>
          <strong>{invoices.length}</strong>
        </article>
        <article className="metric-card">
          <span>Total Billed</span>
          <strong>{totalIssued.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Confirmed Paid</span>
          <strong>{totalPaid.toLocaleString()}</strong>
        </article>
      </section>
      <section className="table-shell" aria-label="Finance invoice list">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Tour Code</th>
              <th>Reservation</th>
              <th>Agency</th>
              <th>Status</th>
              <th>Collection</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Settlement</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td>
                  <Link className="strong-link" href={`/admin/finance/invoices/${invoice.id}` as Route}>
                    {invoice.invoiceNo}
                  </Link>
                  <span className="subtext">Version {invoice.versionNo}</span>
                  <span className="subtext">Due: {invoice.dueDate ?? "Not set"}</span>
                </td>
                <td>{invoice.tourCode ?? "Not set"}</td>
                <td>
                  {invoice.reservationCode ?? invoice.reservationId}
                  {invoice.tourName ? <span className="subtext">{invoice.tourName}</span> : null}
                </td>
                <td>{invoice.agencyName ?? "Not set"}</td>
                <td>
                  <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
                </td>
                <td>
                  {formatLabel(invoice.collectionStatus)}
                  <span className="subtext">
                    {invoice.depositRequired
                      ? `Deposit ${invoice.currency} ${(invoice.depositAmount ?? 0).toLocaleString()}`
                      : "No deposit"}
                  </span>
                </td>
                <td>
                  {invoice.currency} {invoice.totalAmount.toLocaleString()}
                </td>
                <td>
                  {invoice.currency} {invoice.confirmedPaymentTotal.toLocaleString()}
                  <span className="subtext">{invoice.paymentCount} payments</span>
                </td>
                <td>
                  {invoice.settlementStatus ? formatLabel(invoice.settlementStatus) : "Not drafted"}
                  {invoice.finalProfitAmount !== null ? (
                    <span className="subtext">Profit: {invoice.finalProfitAmount.toLocaleString()}</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function loadInvoices(filters: { q?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", invoices: demoFinanceInvoices, isPreview: true };
  }

  const response = await fetch(buildInternalApiUrl("/api/finance/invoices", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return { status: "ready", invoices: demoFinanceInvoices, isPreview: true };
    }
    return {
      status: "error",
      message: payload.error ?? "Unknown finance API error"
    };
  }

  return { status: "ready", invoices: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, filters: { q?: string; status?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
