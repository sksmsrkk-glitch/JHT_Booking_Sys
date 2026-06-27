type InvoicePayment = {
  id: string;
  status: string;
  currency: string;
  amount: number;
  receivedAt: string | null;
  method: string | null;
  referenceNo?: string | null;
};

export function InvoiceDocument({
  invoice,
  billTo,
  remainingAmount,
  title = "Invoice"
}: {
  invoice: {
    invoiceNo: string;
    reservationCode: string | null;
    reservationId: string;
    tourName: string | null;
    status: string;
    currency: string;
    totalAmount: number;
    issuedAt: string | null;
    dueDate: string | null;
    confirmedPaymentTotal: number;
    payments: InvoicePayment[];
  };
  billTo: string | null;
  remainingAmount: number;
  title?: string;
}) {
  return (
    <section className="invoice-document" aria-label={`${title} ${invoice.invoiceNo}`}>
      <div className="invoice-document-header">
        <div>
          <p className="eyebrow">Jungho Travel</p>
          <h2>{title}</h2>
          <p>{invoice.invoiceNo}</p>
        </div>
        <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
      </div>

      <dl className="definition-list columns">
        <div>
          <dt>Bill To</dt>
          <dd>{billTo ?? "Agency not set"}</dd>
        </div>
        <div>
          <dt>Reservation</dt>
          <dd>{invoice.reservationCode ?? invoice.reservationId}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{invoice.issuedAt ? formatDateTime(invoice.issuedAt) : "Not issued"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{invoice.dueDate ?? "Not set"}</dd>
        </div>
      </dl>

      <section className="invoice-line-items">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Currency</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>{invoice.tourName ?? "Tour service"}</strong>
                <span className="subtext">Inbound travel service package</span>
              </td>
              <td>{invoice.currency}</td>
              <td>{formatMoney(invoice.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <dl className="invoice-totals">
        <div>
          <dt>Total</dt>
          <dd>
            {invoice.currency} {formatMoney(invoice.totalAmount)}
          </dd>
        </div>
        <div>
          <dt>Confirmed Paid</dt>
          <dd>
            {invoice.currency} {formatMoney(invoice.confirmedPaymentTotal)}
          </dd>
        </div>
        <div>
          <dt>Balance Due</dt>
          <dd>
            {invoice.currency} {formatMoney(remainingAmount)}
          </dd>
        </div>
      </dl>

      {invoice.payments.length > 0 ? (
        <section className="invoice-payment-note">
          <h3>Payment Records</h3>
          <ul className="clean-list">
            {invoice.payments.map((payment) => (
              <li key={payment.id}>
                {formatLabel(payment.status)} / {payment.currency} {formatMoney(payment.amount)}
                {payment.receivedAt ? ` / ${formatDateTime(payment.receivedAt)}` : ""}
                {payment.referenceNo ? ` / ${payment.referenceNo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString();
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
