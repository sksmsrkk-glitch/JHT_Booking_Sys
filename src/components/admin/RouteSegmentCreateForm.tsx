"use client";

import { useState } from "react";

export function RouteSegmentCreateForm({
  itineraryDayId,
  disabled,
  nextSeq
}: {
  itineraryDayId: string;
  disabled: boolean;
  nextSeq: number;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const response = await fetch(`/api/quote-itinerary-days/${itineraryDayId}/route-segments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        seq: normalizeOptionalNumber(formData.get("seq")),
        originLabel: String(formData.get("originLabel") ?? "").trim(),
        destinationLabel: String(formData.get("destinationLabel") ?? "").trim(),
        travelMinutes: normalizeOptionalNumber(formData.get("travelMinutes")),
        distanceMeters: normalizeOptionalNumber(formData.get("distanceMeters")),
        provider: String(formData.get("provider") ?? "manual").trim() || "manual",
        manualOverride: true
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Route segment creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="row-details">
      <summary>Add Route Segment</summary>
      <form action={submit} className="compact-form">
        <div className="form-grid three-column">
          <label>
            Seq
            <input defaultValue={nextSeq} disabled={disabled || isBusy} min="1" name="seq" step="1" type="number" />
          </label>
          <label>
            Origin
            <input disabled={disabled || isBusy} name="originLabel" placeholder="Hotel" required />
          </label>
          <label>
            Destination
            <input disabled={disabled || isBusy} name="destinationLabel" placeholder="Airport" required />
          </label>
          <label>
            Travel Minutes
            <input disabled={disabled || isBusy} min="0" name="travelMinutes" step="1" type="number" />
          </label>
          <label>
            Distance Meters
            <input disabled={disabled || isBusy} min="0" name="distanceMeters" step="1" type="number" />
          </label>
          <label>
            Provider
            <input defaultValue="manual" disabled={disabled || isBusy} name="provider" />
          </label>
        </div>
        <div className="inline-actions">
          <button className="button-secondary" disabled={disabled || isBusy} type="submit">
            Save Segment
          </button>
          {message ? <span className="danger-text">{message}</span> : null}
        </div>
      </form>
    </details>
  );
}

function normalizeOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
