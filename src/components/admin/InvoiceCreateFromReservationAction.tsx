/**
 * @file 한글 책임: `Invoice Create From Reservation Action` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";
import { useRouter } from "next/navigation";

import { useRef, useState } from "react";

export function InvoiceCreateFromReservationAction({
  reservationId,
  canInvoice
}: {
  reservationId: string;
  canInvoice: boolean;
}) {
  const router = useRouter();
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
      const response = await safeFetch("/api/finance/invoices", {
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
        router.push(`/admin/finance/invoices/${invoiceId}`);
        return;
      }
      requestRouteRefresh();
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
