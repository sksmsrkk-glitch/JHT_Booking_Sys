"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteVersionStatusActions({
  quoteVersionId,
  status,
  publicTotalAmount
}: {
  quoteVersionId: string;
  status: string;
  publicTotalAmount: number;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function updateStatus(nextStatus: "sent" | "accepted" | "cancelled") {
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch(`/api/quote-versions/${quoteVersionId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  const canSend = ["draft", "review"].includes(status) && publicTotalAmount > 0;
  const canAccept = status === "sent";
  const canCancel = ["draft", "review", "sent"].includes(status);

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={!canSend || isBusy} onClick={() => updateStatus("sent")} type="button">
        Send to Agency
      </button>
      <button
        className="button-secondary"
        disabled={!canAccept || isBusy}
        onClick={() => updateStatus("accepted")}
        type="button"
      >
        Mark Accepted
      </button>
      <button
        className="button-secondary danger-button"
        disabled={!canCancel || isBusy}
        onClick={() => updateStatus("cancelled")}
        type="button"
      >
        Cancel Version
      </button>
      {status === "draft" && publicTotalAmount <= 0 ? (
        <span className="warning-text">Add at least one priced item before sending.</span>
      ) : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
