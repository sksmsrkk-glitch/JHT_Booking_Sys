/**
 * @file 한글 책임: `Reservation Create From Quote Action` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";
import { useRouter } from "next/navigation";

import { useState } from "react";

export function ReservationCreateFromQuoteAction({
  acceptedQuoteVersionId,
  quoteCaseId,
  startDate,
  endDate
}: {
  acceptedQuoteVersionId: string | null;
  quoteCaseId: string;
  startDate: string | null;
  endDate: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit() {
    if (!acceptedQuoteVersionId) return;
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch("/api/reservations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        quoteCaseId,
        acceptedQuoteVersionId,
        tourStartDate: startDate,
        tourEndDate: endDate,
        reason: "Admin converted accepted quote into reservation"
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Reservation creation failed");
      setIsBusy(false);
      return;
    }

    const reservationId = result.data?.reservation?.id;
    if (reservationId) {
      router.push(`/admin/reservations/${reservationId}`);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-primary" disabled={!acceptedQuoteVersionId || isBusy} onClick={submit} type="button">
        Create Reservation
      </button>
      {!acceptedQuoteVersionId ? <span className="warning-text">Mark a sent quote version accepted first.</span> : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
