"use client";

import { useState } from "react";

export function InvoiceCreateFromReservationAction({
  reservationId,
  canInvoice
}: {
  reservationId: string;
  canInvoice: boolean;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function issueInvoice() {
    setIsBusy(true);
    setMessage("");

    const response = await fetch("/api/finance/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reservationId, status: "issued" })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Invoice creation failed");
      setIsBusy(false);
      return;
    }

    const invoiceId = result.data?.invoice?.id;
    if (invoiceId) {
      window.location.href = `/admin/finance/invoices/${invoiceId}`;
      return;
    }
    window.location.reload();
  }

  return (
    <div className="inline-actions">
      <button className="button-primary" disabled={!canInvoice || isBusy} onClick={issueInvoice} type="button">
        Issue Invoice
      </button>
      {!canInvoice ? <span className="warning-text">Accepted quote version is required.</span> : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
