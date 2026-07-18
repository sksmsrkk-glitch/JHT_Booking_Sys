/**
 * @file 한글 책임: `Reservation Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function ReservationActions({
  reservationId,
  hasTourStartDate,
  disabledReason
}: {
  reservationId: string;
  hasTourStartDate: boolean;
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function generateTasks() {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/reservations/${reservationId}/generate-operation-tasks`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Task generation failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button
        className="button-secondary"
        disabled={isBusy || !hasTourStartDate || Boolean(disabledReason)}
        onClick={generateTasks}
        type="button"
      >
        Generate Tasks
      </button>
      {disabledReason ? <span className="warning-text">{disabledReason}</span> : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
