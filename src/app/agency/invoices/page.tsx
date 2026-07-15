import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import type { AgencyInvoiceListItem } from "@/features/agency-portal/types";
import { demoAgencyInvoices } from "@/features/finance/demo-invoices";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/api/pagination";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; invoices: AgencyInvoiceListItem[]; pagination: PaginationMeta; isPreview?: boolean }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const agencyRoute = "/agency" as Route;
type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AgencyInvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loadState = await loadInvoices(params);

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

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed during development, so this page shows sample invoice rows.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Invoices could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Partner session required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <InvoiceDatabase invoices={loadState.invoices} pagination={loadState.pagination} />
          <PaginationControls action="/agency/invoices" pagination={loadState.pagination} />
        </>
      ) : null}

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

function InvoiceDatabase({ invoices, pagination }: { invoices: AgencyInvoiceListItem[]; pagination: PaginationMeta }) {
  if (invoices.length === 0) {
    return (
      <section className="empty-state">
        <h2>No invoices yet</h2>
        <p>Issued invoices from JHT will appear here.</p>
      </section>
    );
  }

  const payableCount = invoices.filter((invoice) => invoice.collectionStatus !== "paid").length;
  const firstCurrency = invoices[0]?.currency ?? "";
  const usesOneCurrency = invoices.every((invoice) => invoice.currency === firstCurrency);
  const totalAmount = invoices.reduce((total, invoice) => total + invoice.totalAmount, 0);
  const confirmedPaymentTotal = invoices.reduce((total, invoice) => total + invoice.confirmedPaymentTotal, 0);

  return (
    <section className="partner-database-shell" aria-label="Agency invoices">
      <div className="partner-database-toolbar">
        <div>
          <p className="eyebrow">Invoice Database</p>
          <h2>Issued invoice records</h2>
        </div>
        <div className="partner-view-tabs" aria-label="Invoice views">
          <span className="active">Table</span>
          <span>Collection</span>
          <span>Due Dates</span>
        </div>
      </div>

      <div className="partner-database-metrics" aria-label="Invoice metrics">
        <div>
          <span>Invoices</span>
          <strong>{pagination.total}</strong>
        </div>
        <div>
          <span>Receivable</span>
          <strong>{payableCount}</strong>
        </div>
        <div>
          <span>Total</span>
          <strong>{usesOneCurrency ? formatMoney(firstCurrency, totalAmount) : "Mixed"}</strong>
        </div>
        <div>
          <span>Paid</span>
          <strong>{usesOneCurrency ? formatMoney(firstCurrency, confirmedPaymentTotal) : "Mixed"}</strong>
        </div>
      </div>

      <div className="partner-database-grid partner-invoices-grid">
        <div className="partner-database-header" role="row">
          <span>Invoice</span>
          <span>Tour Code</span>
          <span>Reservation</span>
          <span>Status</span>
          <span>Collection</span>
          <span>Total</span>
          <span>Paid</span>
          <span>Due</span>
        </div>

        {invoices.map((invoice) => (
          <article className="partner-database-row" key={invoice.id}>
            <div className="partner-database-title">
              <small>Invoice</small>
              <strong>
                <Link className="strong-link" href={`/agency/invoices/${invoice.id}` as Route}>
                  {invoice.invoiceNo}
                </Link>
              </strong>
              <span>Version {invoice.versionNo}</span>
              {invoice.storagePath ? <span>File ready</span> : null}
            </div>
            <div className="partner-property">
              <small>Tour Code</small>
              <strong>{invoice.tourCode ?? "Not set"}</strong>
            </div>
            <div className="partner-property">
              <small>Reservation</small>
              <strong>{invoice.reservationCode ?? invoice.reservationId}</strong>
              {invoice.tourName ? <span>{invoice.tourName}</span> : null}
            </div>
            <div className="partner-property">
              <small>Status</small>
              <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
            </div>
            <div className="partner-property">
              <small>Collection</small>
              <strong>{formatLabel(invoice.collectionStatus)}</strong>
              <span>{invoice.collectionTiming ? formatLabel(invoice.collectionTiming) : "Timing not set"}</span>
            </div>
            <div className="partner-property">
              <small>Total</small>
              <strong>{formatMoney(invoice.currency, invoice.totalAmount)}</strong>
            </div>
            <div className="partner-property">
              <small>Paid</small>
              <strong>{formatMoney(invoice.currency, invoice.confirmedPaymentTotal)}</strong>
              <span>{invoice.paymentCount} payments</span>
            </div>
            <div className="partner-property">
              <small>Due Date</small>
              <strong>{invoice.dueDate ?? "Not set"}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

async function loadInvoices(params: { page?: string; pageSize?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    if (!isDemoModeEnabled()) {
      return { status: "auth-required", message: "Log in with an approved partner account to review invoices." };
    }
    return {
      status: "ready",
      invoices: demoAgencyInvoices,
      pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoAgencyInvoices.length, demoAgencyInvoices.length),
      isPreview: true
    };
  }

  const url = buildInternalApiUrl("/api/agency/invoices", headerStore);
  if (params.page) url.searchParams.set("page", params.page);
  if (params.pageSize) url.searchParams.set("pageSize", params.pageSize);
  const response = await fetch(url, {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      if (!isDemoModeEnabled()) {
        return { status: "auth-required", message: payload.error ?? "This account cannot access partner invoices." };
      }
      return {
        status: "ready",
        invoices: demoAgencyInvoices,
        pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, demoAgencyInvoices.length, demoAgencyInvoices.length),
        isPreview: true
      };
    }
    return {
      status: "error",
      message: payload.error ?? "Unknown invoice API error"
    };
  }

  return { status: "ready", invoices: payload.data ?? [], pagination: payload.pagination };
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

function formatMoney(currency: string, amount: number) {
  if (!amount) return "-";
  return `${currency} ${amount.toLocaleString("en-US")}`;
}
