"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteExportRetryAction({ exportId, status }: { exportId: string; status: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const canRetry = status === "failed";

  async function retryExport() {
    setIsBusy(true);
    setMessage("");

    const response = await fetch(`/api/quote-exports/${exportId}/retry`, {
      method: "POST"
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Export retry failed");
      setIsBusy(false);
      return;
    }

    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isBusy || !canRetry} onClick={retryExport} type="button">
        Retry
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
