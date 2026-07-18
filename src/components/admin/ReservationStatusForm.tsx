/**
 * @file 한글 책임: `Reservation Status Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import { RESERVATION_STATUSES } from "@/features/reservation/queries";
import { HIGH_RISK_RESERVATION_STATUSES } from "@/lib/domain/reservations.mjs";
import { submitJson } from "@/lib/client/api";

export function ReservationStatusForm({
  reservationId,
  currentStatus
}: {
  reservationId: string;
  currentStatus: string;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const isHighRisk = HIGH_RISK_RESERVATION_STATUSES.includes(status);

  async function updateStatus() {
    // 확정/취소 같은 고위험 전이는 사유가 필수입니다(서버도 동일하게 강제).
    if (isHighRisk && !reason.trim()) {
      setMessage("A reason is required to confirm or cancel a reservation.");
      return;
    }
    setIsBusy(true);
    setMessage("");
    const result = await submitJson(`/api/reservations/${reservationId}`, { status, reason }, { method: "PATCH" });
    if (!result.ok) {
      setMessage(result.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="stacked-form">
      <div className="form-grid two-column">
        <label>
          Status
          <select disabled={isBusy} onChange={(event) => setStatus(event.target.value)} value={status}>
            {RESERVATION_STATUSES.map((reservationStatus) => (
              <option key={reservationStatus} value={reservationStatus}>
                {formatLabel(reservationStatus)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason{isHighRisk ? " (required)" : ""}
          <input
            disabled={isBusy}
            onChange={(event) => setReason(event.target.value)}
            placeholder={isHighRisk ? "Why is this reservation being confirmed/cancelled?" : "Optional status note"}
            required={isHighRisk}
            value={reason}
          />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy || status === currentStatus} onClick={updateStatus} type="button">
          Update Status
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
