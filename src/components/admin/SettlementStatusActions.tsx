"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function SettlementStatusActions({ settlementId, status }: { settlementId: string; status: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const actions = getActions(status);

  async function updateStatus(nextStatus: string) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/finance/settlements/${settlementId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Settlement update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  if (actions.length === 0) {
    return <span className="subtext">Locked</span>;
  }

  return (
    <div className="inline-actions">
      {actions.map((action) => (
        <button
          className={action.variant === "primary" ? "button-primary" : "button-secondary"}
          disabled={isBusy}
          key={action.status}
          onClick={() => updateStatus(action.status)}
          type="button"
        >
          {action.label}
        </button>
      ))}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

function getActions(status: string) {
  if (status === "draft") {
    return [
      { status: "review", label: "Review", variant: "secondary" },
      { status: "approved", label: "Approve", variant: "primary" }
    ];
  }

  if (status === "review") {
    return [
      { status: "draft", label: "Back to Draft", variant: "secondary" },
      { status: "approved", label: "Approve", variant: "primary" }
    ];
  }

  if (status === "approved") {
    return [{ status: "closed", label: "Close", variant: "primary" }];
  }

  return [];
}
