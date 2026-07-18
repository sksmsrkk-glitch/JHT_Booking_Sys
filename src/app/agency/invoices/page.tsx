/**
 * @file 한글 책임: Next.js App Router의 `/agency/invoices` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { listAgencyInvoicePage } from "@/features/agency-portal/queries";
import type { AgencyInvoiceListItem } from "@/features/agency-portal/types";
import { demoAgencyInvoices } from "@/features/finance/demo-invoices";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, parsePagination, type PaginationMeta } from "@/lib/api/pagination";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { classifyPageDataError, getAgencyPageContext } from "@/lib/api/server-page-context";

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
  try {
    const { supabase, user } = await getAgencyPageContext();
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page);
    if (params.pageSize) searchParams.set("pageSize", params.pageSize);
    const page = await listAgencyInvoicePage(supabase, user.agencyAccountId, parsePagination(searchParams));
    return { status: "ready", invoices: page.items, pagination: page.pagination };
  } catch (error) {
    const failure = classifyPageDataError(error);
    if (failure.status === "auth-required") {
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
    return failure;
  }
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
