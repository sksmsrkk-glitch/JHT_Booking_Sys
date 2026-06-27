"use client";

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
    const response = await fetch(`/api/reservations/${reservationId}/generate-operation-tasks`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Task generation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
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
