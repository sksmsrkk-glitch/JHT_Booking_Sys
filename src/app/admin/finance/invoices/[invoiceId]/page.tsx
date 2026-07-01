import type { Route } from "next";
import Link from "next/link";
import { PaymentCreateForm } from "@/components/admin/PaymentCreateForm";
import { InvoiceDocument } from "@/components/finance/InvoiceDocument";
import type { InvoiceDetail } from "@/features/finance/types";
import { demoFinanceInvoice } from "@/features/finance/demo-invoices";
import { summarizeInvoicePayments } from "@/lib/domain/finance.mjs";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ invoiceId: string }>;

type LoadState =
  | { status: "ready"; invoice: InvoiceDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const invoicesRoute = "/admin/finance/invoices" as Route;

export default async function AdminInvoiceDetailPage({ params }: { params: PageParams }) {
  const { invoiceId } = await params;
  const loadState = await loadInvoice(invoiceId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Finance</p>
            <h1>Invoice Detail</h1>
            <p>Invoice, payment, and settlement summary for finance/admin users.</p>
          </div>
          <Link className="button-secondary" href={invoicesRoute}>
            Back to Finance
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
  const paymentDisabledReason =
    invoice.settlementStatus === "closed" ? "This reservation settlement is closed, so new payments are locked." : undefined;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Finance</p>
          <h1>{invoice.invoiceNo}</h1>
          <p>{invoice.tourName ?? invoice.reservationCode ?? invoice.reservationId}</p>
        </div>
        <div className="inline-actions">
          <Link className="button-secondary" href={`/api/finance/invoices/${invoice.id}/export-xlsx` as Route}>
            Download Excel
          </Link>
          <Link className="button-secondary" href={invoicesRoute}>
            Back to Finance
          </Link>
        </div>
      </div>

      <section className="metric-row">
        <article className="metric-card">
          <span>Total</span>
          <strong>{invoice.totalAmount.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Confirmed Paid</span>
          <strong>{invoice.confirmedPaymentTotal.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Remaining</span>
          <strong>{remainingAmount.toLocaleString()}</strong>
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
              <dt>Agency</dt>
              <dd>{invoice.agencyName ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Reservation</dt>
              <dd>{invoice.reservationCode ?? invoice.reservationId}</dd>
            </div>
            <div>
              <dt>Due Date</dt>
              <dd>{invoice.paymentDeadline ?? invoice.dueDate ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Deposit</dt>
              <dd>
                {invoice.depositRequired
                  ? `${invoice.currency} ${(invoice.depositAmount ?? 0).toLocaleString()}`
                  : "Not required"}
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Record Payment</h2>
          <PaymentCreateForm
            currency={invoice.currency}
            disabledReason={paymentDisabledReason}
            invoiceId={invoice.id}
            remainingAmount={remainingAmount}
          />
        </article>
      </section>

      <section className="panel-section print-surface">
        <div className="section-heading no-print">
          <div>
            <h2>Printable Invoice</h2>
            <p>Use print for PDF output or download Excel for editable invoice data.</p>
          </div>
          <Link className="button-secondary" href={`/api/finance/invoices/${invoice.id}/export-xlsx` as Route}>
            Download Excel
          </Link>
        </div>
        <InvoiceDocument billTo={invoice.agencyName} invoice={invoice} remainingAmount={remainingAmount} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Payments</h2>
          <span>{invoice.payments.length} records</span>
        </div>
        {invoice.payments.length > 0 ? (
          <section className="table-shell" aria-label="Invoice payments">
            <table>
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Received</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <strong>{payment.method ?? "Manual"}</strong>
                      <span className="subtext">{payment.idempotencyKey ?? payment.id}</span>
                    </td>
                    <td>
                      <span className={`status-dot status-${payment.status}`}>{formatLabel(payment.status)}</span>
                    </td>
                    <td>
                      {payment.currency} {payment.amount.toLocaleString()}
                    </td>
                    <td>{payment.receivedAt ? formatDateTime(payment.receivedAt) : "Not set"}</td>
                    <td>{payment.referenceNo ?? "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No payments</h2>
            <p>Record confirmed payment after bank reconciliation.</p>
          </section>
        )}
      </section>

      <section className="notice">
        <h2>Finance controls</h2>
        <ul className="clean-list">
          <li>Payment writes require finance/admin role.</li>
          <li>Payment creation uses idempotency keys and writes high-risk audit logs.</li>
          <li>Agency users can read invoice summaries only, not this internal payment control page.</li>
        </ul>
      </section>
    </>
  );
}

async function loadInvoice(invoiceId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "ready", invoice: demoFinanceInvoice };
  }

  const response = await fetch(buildInternalApiUrl(`/api/finance/invoices/${invoiceId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && invoiceId.startsWith("preview-")) {
      return { status: "ready", invoice: demoFinanceInvoice };
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
