/**
 * @file 한글 책임: `Gmail Review Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { QuoteCaseListItem } from "@/features/quotation/types";
import type { ReservationListItem } from "@/features/reservation/types";

export function GmailReviewActions({
  threadId,
  quoteCases,
  reservations,
  defaultQuoteCaseId,
  defaultReservationId
}: {
  threadId: string;
  quoteCases: QuoteCaseListItem[];
  reservations: ReservationListItem[];
  defaultQuoteCaseId: string | null;
  defaultReservationId: string | null;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [quoteCaseId, setQuoteCaseId] = useState(defaultQuoteCaseId ?? "");
  const [reservationId, setReservationId] = useState(defaultReservationId ?? "");

  async function updateReview(action: "link" | "unlink") {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/automation/gmail-review/${threadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        quoteCaseId: action === "link" ? quoteCaseId : null,
        reservationId: action === "link" ? reservationId : null
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Gmail review update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="stacked-actions">
      <select disabled={isBusy} onChange={(event) => setQuoteCaseId(event.target.value)} value={quoteCaseId}>
        <option value="">Select quote case</option>
        {quoteCases.map((quoteCase) => (
          <option key={quoteCase.id} value={quoteCase.id}>
            {formatQuoteCaseOption(quoteCase)}
          </option>
        ))}
      </select>
      <select disabled={isBusy} onChange={(event) => setReservationId(event.target.value)} value={reservationId}>
        <option value="">Optional reservation</option>
        {reservations.map((reservation) => (
          <option key={reservation.id} value={reservation.id}>
            {formatReservationOption(reservation)}
          </option>
        ))}
      </select>
      <div className="inline-actions compact-actions">
        <button
          className="button-primary"
          disabled={isBusy || (!quoteCaseId && !reservationId)}
          onClick={() => updateReview("link")}
          type="button"
        >
          Link
        </button>
        <button className="button-secondary" disabled={isBusy} onClick={() => updateReview("unlink")} type="button">
          Unlink
        </button>
      </div>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

function formatQuoteCaseOption(quoteCase: QuoteCaseListItem) {
  const tour = quoteCase.tourName ? ` - ${quoteCase.tourName}` : "";
  const agency = quoteCase.agencyName ? ` (${quoteCase.agencyName})` : "";
  return `${quoteCase.caseCode}${tour}${agency}`;
}

function formatReservationOption(reservation: ReservationListItem) {
  const tour = reservation.tourName ? ` - ${reservation.tourName}` : "";
  const agency = reservation.agencyName ? ` (${reservation.agencyName})` : "";
  return `${reservation.reservationCode}${tour}${agency}`;
}
