"use client";

import { useState } from "react";

export function QuoteRequestActions({ quoteCaseId, tourName }: { quoteCaseId: string; tourName: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function sendBookingRequest(formData: FormData) {
    await submit(`/api/agency/quote-cases/${quoteCaseId}/booking-request`, {
      message: String(formData.get("bookingMessage") ?? "").trim(),
      agencyReferenceNo: normalizeOptionalString(formData.get("agencyReferenceNo"))
    });
  }

  async function sendRevisionRequest(formData: FormData) {
    const revisionMessage = String(formData.get("revisionMessage") ?? "").trim();
    await submit(`/api/agency/quote-cases/${quoteCaseId}/revision-request`, {
      title: `Revision request: ${tourName}`,
      message: revisionMessage,
      requestedChanges: revisionMessage ? [revisionMessage] : []
    });
  }

  async function submit(url: string, payload: Record<string, unknown>) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Request failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="row-details">
      <summary>Request</summary>
      <div className="stack">
        <form action={sendBookingRequest} className="compact-form">
          <label>
            Booking Message
            <textarea name="bookingMessage" placeholder="Please proceed with booking." required rows={3} />
          </label>
          <label>
            Agency Ref.
            <input name="agencyReferenceNo" placeholder="Optional" />
          </label>
          <button className="button-secondary" disabled={isBusy} type="submit">
            Book
          </button>
        </form>
        <form action={sendRevisionRequest} className="compact-form">
          <label>
            Revision Message
            <textarea name="revisionMessage" placeholder="Please revise dates, pax, or itinerary." required rows={3} />
          </label>
          <button className="button-secondary" disabled={isBusy} type="submit">
            Revise
          </button>
        </form>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </details>
  );
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}
