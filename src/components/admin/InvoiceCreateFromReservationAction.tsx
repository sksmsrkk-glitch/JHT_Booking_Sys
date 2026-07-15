"use client";

import { useRef, useState } from "react";

export function InvoiceCreateFromReservationAction({
  reservationId,
  canInvoice
}: {
  reservationId: string;
  canInvoice: boolean;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  async function issueInvoice() {
    setIsBusy(true);
    setMessage("");

    // 한 번의 사용자 액션에는 한 멱등성 키를 부여해 중복 클릭과 전송 재시도를 차단합니다.
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const response = await fetch("/api/finance/invoices", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify({ reservationId, status: "issued" })
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Invoice creation failed");
        setIsBusy(false);
        return;
      }

      const invoiceId = result.data?.invoice?.id;
      idempotencyKeyRef.current = null;
      if (invoiceId) {
        window.location.href = `/admin/finance/invoices/${invoiceId}`;
        return;
      }
      window.location.reload();
    } catch {
      setMessage("Network error while creating the invoice. Please retry.");
      setIsBusy(false);
    }
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
