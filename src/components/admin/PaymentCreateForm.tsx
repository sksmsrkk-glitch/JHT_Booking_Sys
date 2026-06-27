"use client";

import { useState } from "react";

export function PaymentCreateForm({
  invoiceId,
  currency,
  remainingAmount,
  disabledReason
}: {
  invoiceId: string;
  currency: string;
  remainingAmount: number;
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createPayment(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const amount = Number(formData.get("amount") ?? 0);
    const referenceNo = String(formData.get("referenceNo") ?? "").trim();
    const payload = {
      amount,
      currency,
      status: String(formData.get("status") ?? "confirmed"),
      method: String(formData.get("method") ?? "").trim(),
      referenceNo,
      idempotencyKey: `${invoiceId}:${referenceNo || "manual"}:${amount}`
    };

    const response = await fetch(`/api/finance/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Payment creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form action={createPayment} className="stacked-form">
      {disabledReason ? <p className="warning-text">{disabledReason}</p> : null}
      <div className="form-grid two-column">
        <label>
          Amount
          <input
            defaultValue={remainingAmount > 0 ? remainingAmount : ""}
            disabled={Boolean(disabledReason)}
            min="0"
            name="amount"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label>
          Status
          <select defaultValue="confirmed" disabled={Boolean(disabledReason)} name="status">
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label>
          Method
          <input disabled={Boolean(disabledReason)} name="method" placeholder="wire, card, cash" />
        </label>
        <label>
          Reference No.
          <input disabled={Boolean(disabledReason)} name="referenceNo" placeholder="Bank ref / receipt no." required />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy || Boolean(disabledReason)} type="submit">
          Record Payment
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}
