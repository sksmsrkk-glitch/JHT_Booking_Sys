import type { Route } from "next";
import Link from "next/link";
import { InvoiceDocument } from "@/components/finance/InvoiceDocument";
import type { AgencyInvoiceDetail } from "@/features/agency-portal/types";
import { demoAgencyInvoice } from "@/features/finance/demo-invoices";
import { summarizeInvoicePayments } from "@/lib/domain/finance.mjs";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ invoiceId: string }>;

type LoadState =
  | { status: "ready"; invoice: AgencyInvoiceDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const invoicesRoute = "/agency/invoices" as Route;

export default async function AgencyInvoiceDetailPage({ params }: { params: PageParams }) {
  const { invoiceId } = await params;
  const loadState = await loadInvoice(invoiceId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency Portal</p>
            <h1>Invoice Detail</h1>
            <p>Issued invoice, due date, payment summary, and file status.</p>
          </div>
          <Link className="button-secondary" href={invoicesRoute}>
            Back to Invoices
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Invoice not found" : "Invoice could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const invoice = loadState.invoice;
  const paymentSummary = summarizeInvoicePayments({
    totalAmount: invoice.totalAmount,
    payments: invoice.payments.map((payment) => ({
      status: payment.status,
      amount: payment.amount
    }))
  });
  const remainingAmount = paymentSummary.remainingAmount;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>{invoice.invoiceNo}</h1>
          <p>{invoice.tourName ?? invoice.reservationCode ?? invoice.reservationId}</p>
        </div>
        <Link className="button-secondary" href={invoicesRoute}>
          Back to Invoices
        </Link>
      </div>

      <section className="metric-row">
        <article className="metric-card">
          <span>Total</span>
          <strong>{invoice.totalAmount.toLocaleString("en-US")}</strong>
        </article>
        <article className="metric-card">
          <span>Paid</span>
          <strong>{invoice.confirmedPaymentTotal.toLocaleString("en-US")}</strong>
        </article>
        <article className="metric-card">
          <span>Remaining</span>
          <strong>{remainingAmount.toLocaleString("en-US")}</strong>
        </article>
      </section>

      <section className="detail-grid">
        <article className="panel">
          <h2>Invoice</h2>
          <dl className="definition-list">
            <div>
              <dt>Tour Code</dt>
              <dd>{invoice.tourCode ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{invoice.versionNo}</dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd>{formatLabel(invoice.collectionStatus)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Due Date</dt>
              <dd>{invoice.dueDate ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Issued At</dt>
              <dd>{invoice.issuedAt ? formatDateTime(invoice.issuedAt) : "Not issued"}</dd>
            </div>
            <div>
              <dt>File</dt>
              <dd>{invoice.storagePath ? "Ready" : "Not uploaded"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Payment Summary</h2>
          <dl className="definition-list">
            <div>
              <dt>Payment Deadline</dt>
              <dd>{invoice.paymentDeadline ?? invoice.dueDate ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Deposit</dt>
              <dd>
                {invoice.depositRequired
                  ? `${invoice.currency} ${(invoice.depositAmount ?? 0).toLocaleString("en-US")}`
                  : "Not required"}
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{invoice.currency}</dd>
            </div>
            <div>
              <dt>Payment Records</dt>
              <dd>{invoice.payments.length}</dd>
            </div>
            <div>
              <dt>Confirmed Paid</dt>
              <dd>
                {invoice.currency} {invoice.confirmedPaymentTotal.toLocaleString("en-US")}
              </dd>
            </div>
            <div>
              <dt>Remaining</dt>
              <dd>
                {invoice.currency} {remainingAmount.toLocaleString("en-US")}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel-section print-surface">
        <div className="section-heading no-print">
          <div>
            <h2>Invoice Document</h2>
            <p>Use this invoice view for agency-side review and printing.</p>
          </div>
          <span>{invoice.currency}</span>
        </div>
        <InvoiceDocument billTo={invoice.agencyName} invoice={invoice} remainingAmount={remainingAmount} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Payments</h2>
          <span>Read-only</span>
        </div>
        {invoice.payments.length > 0 ? (
          <section className="table-shell" aria-label="Agency invoice payments">
            <table>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.method ?? "Payment"}</td>
                    <td>
                      <span className={`status-dot status-${payment.status}`}>{formatLabel(payment.status)}</span>
                    </td>
                    <td>
                      {payment.currency} {payment.amount.toLocaleString("en-US")}
                    </td>
                    <td>{payment.receivedAt ? formatDateTime(payment.receivedAt) : "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No payments recorded</h2>
            <p>Confirmed payments will appear here after JHT finance reconciliation.</p>
          </section>
        )}
      </section>

      <section className="notice">
        <h2>Agency-safe boundary</h2>
        <ul className="clean-list">
          <li>This page shows invoice and payment summaries only.</li>
          <li>Internal payment references, expenses, shopping commissions, settlements, and supplier costs are not queried.</li>
          <li>Payments are read-only for Agency users.</li>
        </ul>
      </section>
    </>
  );
}

async function loadInvoice(invoiceId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", invoice: demoAgencyInvoice };
  }

  const response = await fetch(buildInternalApiUrl(`/api/agency/invoices/${invoiceId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && invoiceId.startsWith("preview-")) {
      return { status: "ready", invoice: demoAgencyInvoice };
    }
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Invoice not found" };
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown invoice detail API error"
    };
  }

  return { status: "ready", invoice: payload.data };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
