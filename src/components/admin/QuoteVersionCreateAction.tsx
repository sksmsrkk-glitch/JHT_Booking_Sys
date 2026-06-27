"use client";

import { useState } from "react";

export function QuoteVersionCreateAction({
  quoteCaseId,
  disabledReason
}: {
  quoteCaseId: string;
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createVersion() {
    setIsBusy(true);
    setMessage("");

    const response = await fetch(`/api/quote-cases/${quoteCaseId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Quote version creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="inline-actions">
      <button className="button-primary" disabled={Boolean(disabledReason) || isBusy} onClick={createVersion} type="button">
        Create New Draft Version
      </button>
      {disabledReason ? <span className="warning-text">{disabledReason}</span> : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
