"use client";

import { useState } from "react";
import { RESERVATION_STATUSES } from "@/features/reservation/queries";

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

  async function updateStatus() {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/reservations/${reservationId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, reason })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
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
          Reason
          <input
            disabled={isBusy}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional status note"
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
