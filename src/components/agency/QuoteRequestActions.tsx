/**
 * @file 한글 책임: `Quote Request Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useRef, useState } from "react";

export function QuoteRequestActions({
  quoteCaseId,
  quoteCaseStatus,
  tourName
}: {
  quoteCaseId: string;
  quoteCaseStatus: string;
  tourName: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const bookingIdempotencyKey = useRef<string | null>(null);
  const revisionIdempotencyKey = useRef<string | null>(null);
  const canBook = ["sent", "accepted"].includes(quoteCaseStatus);
  const canRevise = ["quoting", "sent", "revision_requested"].includes(quoteCaseStatus);

  async function sendBookingRequest(formData: FormData) {
    await submit(
      `/api/agency/quote-cases/${quoteCaseId}/booking-request`,
      {
        message: String(formData.get("bookingMessage") ?? "").trim(),
        agencyReferenceNo: normalizeOptionalString(formData.get("agencyReferenceNo"))
      },
      bookingIdempotencyKey
    );
  }

  async function sendRevisionRequest(formData: FormData) {
    const revisionMessage = String(formData.get("revisionMessage") ?? "").trim();
    await submit(
      `/api/agency/quote-cases/${quoteCaseId}/revision-request`,
      {
        title: `Revision request: ${tourName}`,
        message: revisionMessage,
        requestedChanges: revisionMessage ? [revisionMessage] : []
      },
      revisionIdempotencyKey
    );
  }

  async function submit(
    url: string,
    payload: Record<string, unknown>,
    idempotencyKeyRef: { current: string | null }
  ) {
    setIsBusy(true);
    setMessage("");
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    const response = await safeFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Request failed");
      setIsBusy(false);
      return;
    }
    idempotencyKeyRef.current = null;
    setIsBusy(false);
    requestRouteRefresh();
  }

  return (
    <details className="row-details">
      <summary>Request</summary>
      <div className="stack">
        {canBook ? (
          <form action={sendBookingRequest} className="compact-form">
            <label>
              Booking Message
              <textarea name="bookingMessage" placeholder="Please proceed with booking." required rows={3} />
            </label>
            <label>
              Agency Ref.
              <input name="agencyReferenceNo" placeholder="Optional" />
            </label>
            <button className="button-secondary" disabled={isBusy} type="submit">
              Book
            </button>
          </form>
        ) : null}
        {canRevise ? (
          <form action={sendRevisionRequest} className="compact-form">
            <label>
              Revision Message
              <textarea name="revisionMessage" placeholder="Please revise dates, pax, or itinerary." required rows={3} />
            </label>
            <button className="button-secondary" disabled={isBusy} type="submit">
              Revise
            </button>
          </form>
        ) : null}
        {!canBook && !canRevise ? (
          <span className="subtext">This quote is closed. Use the reservation change or cancellation workflow.</span>
        ) : null}
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </details>
  );
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
