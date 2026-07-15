"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function MigrationBatchActions({ batchId, status, errorCount }: { batchId: string; status: string; errorCount: number }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const canValidate = status === "uploaded" || status === "mapped" || status === "failed";
  const canApprove = status === "validated" && errorCount === 0;
  const canImport = status === "approved" && errorCount === 0;

  async function updateStatus(nextStatus: "validated" | "approved" | "imported" | "failed") {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/migrations/notion-csv/batches/${batchId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Migration status update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions compact-actions">
      <button className="button-secondary" disabled={isBusy || !canValidate} onClick={() => updateStatus("validated")} type="button">
        Validate
      </button>
      <button className="button-primary" disabled={isBusy || !canApprove} onClick={() => updateStatus("approved")} type="button">
        Approve
      </button>
      <button className="button-primary" disabled={isBusy || !canImport} onClick={() => updateStatus("imported")} type="button">
        Import
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
