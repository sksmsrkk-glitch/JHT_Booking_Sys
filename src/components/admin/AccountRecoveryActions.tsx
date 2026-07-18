"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function AccountRecoveryActions({ requestId }: { requestId: string }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function update(status: "resolved" | "dismissed") {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/admin/account-recovery/${requestId}`, {
      body: JSON.stringify({ resolutionNote: note, status }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error ?? "Recovery request update failed.");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="recovery-admin-actions">
      <input
        aria-label="Resolution note"
        onChange={(event) => setNote(event.target.value)}
        placeholder="Resolution note"
        type="text"
        value={note}
      />
      <button className="button-primary mini-button" disabled={isBusy} onClick={() => update("resolved")} type="button">
        Resolve
      </button>
      <button className="button-secondary mini-button" disabled={isBusy} onClick={() => update("dismissed")} type="button">
        Dismiss
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
