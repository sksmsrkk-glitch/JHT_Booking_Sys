"use client";

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

    const response = await fetch("/api/reservations", {
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
