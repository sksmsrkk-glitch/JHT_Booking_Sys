"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteVersionExportAction({
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
  const isBlockedStatus = ["cancelled", "expired"].includes(status);
  const isDisabled = isBusy || isBlockedStatus || publicTotalAmount <= 0;

  async function queueExport() {
    setIsBusy(true);
    setMessage("");

    const response = await fetch(`/api/quote-versions/${quoteVersionId}/export-xlsx`, {
      method: "POST"
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Export queue failed");
      setIsBusy(false);
      return;
    }

    const exportStatus = result.data?.status ? ` (${result.data.status})` : "";
    setMessage(`Export queued${exportStatus}.`);
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isDisabled} onClick={queueExport} type="button">
        Export XLSX
      </button>
      {publicTotalAmount <= 0 ? <span className="warning-text">Add priced items before export.</span> : null}
      {isBlockedStatus ? <span className="warning-text">Cancelled or expired versions cannot be exported.</span> : null}
      {message ? <span className={message.includes("failed") ? "danger-text" : "success-text"}>{message}</span> : null}
    </div>
  );
}
