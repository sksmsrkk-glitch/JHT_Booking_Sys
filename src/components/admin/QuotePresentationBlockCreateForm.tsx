"use client";

import { useState } from "react";
import type { QuoteItineraryDayDetail } from "@/features/quotation/types";

const BLOCK_TYPES = ["image", "hotel", "menu", "attraction", "description"];
const DISPLAY_CONTEXTS = ["cover", "itinerary", "hotel", "meal", "attraction", "terms"];

export function QuotePresentationBlockCreateForm({
  disabled,
  itineraryDays,
  quoteVersionId
}: {
  disabled: boolean;
  itineraryDays: QuoteItineraryDayDetail[];
  quoteVersionId: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const metadata = parseJsonObject(formData.get("metadata"));
    if (!metadata.ok) {
      setMessage(metadata.message);
      setIsBusy(false);
      return;
    }

    const response = await fetch(`/api/quote-versions/${quoteVersionId}/presentation-blocks`, {
      body: JSON.stringify({
        quoteItineraryDayId: normalizeOptionalString(formData.get("quoteItineraryDayId")),
        blockType: String(formData.get("blockType") ?? "image"),
        displayContext: String(formData.get("displayContext") ?? "itinerary"),
        title: normalizeOptionalString(formData.get("title")),
        description: normalizeOptionalString(formData.get("description")),
        imageStoragePath: normalizeOptionalString(formData.get("imageStoragePath")),
        imageUrl: normalizeOptionalString(formData.get("imageUrl")),
        altText: normalizeOptionalString(formData.get("altText")),
        sortOrder: normalizeOptionalNumber(formData.get("sortOrder")) ?? 1,
        isPublic: formData.get("isPublic") !== null,
        metadata: metadata.value
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Presentation block creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <details className="row-details">
      <summary>Add presentation block</summary>
      <form action={submit} className="stacked-form">
        <div className="form-grid three-column">
          <label>
            Block Type
            <select disabled={disabled || isBusy} name="blockType">
              {BLOCK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Display Context
            <select disabled={disabled || isBusy} name="displayContext">
              {DISPLAY_CONTEXTS.map((context) => (
                <option key={context} value={context}>
                  {formatLabel(context)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Itinerary Day
            <select disabled={disabled || isBusy} name="quoteItineraryDayId">
              <option value="">Version-level</option>
              {itineraryDays.map((day) => (
                <option key={day.id} value={day.id}>
                  Day {day.dayNo}
                  {day.title ? ` - ${day.title}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <input defaultValue="1" disabled={disabled || isBusy} min="1" name="sortOrder" step="1" type="number" />
          </label>
          <label className="checkbox-label">
            <input defaultChecked disabled={disabled || isBusy} name="isPublic" type="checkbox" />
            Public
          </label>
        </div>
        <label className="full-width-field">
          Title
          <input disabled={disabled || isBusy} name="title" placeholder="Hotel, restaurant, attraction, or itinerary title" />
        </label>
        <label className="full-width-field">
          Description
          <textarea disabled={disabled || isBusy} name="description" rows={3} />
        </label>
        <label className="full-width-field">
          Image URL
          <input disabled={disabled || isBusy} name="imageUrl" placeholder="https://..." />
        </label>
        <label className="full-width-field">
          Image Storage Path
          <input disabled={disabled || isBusy} name="imageStoragePath" placeholder="quote-media/..." />
        </label>
        <label className="full-width-field">
          Alt Text
          <input disabled={disabled || isBusy} name="altText" placeholder="Customer-safe image description" />
        </label>
        <label className="full-width-field">
          Metadata JSON
          <textarea defaultValue="{}" disabled={disabled || isBusy} name="metadata" rows={2} />
        </label>
        <div className="inline-actions">
          <button className="button-secondary" disabled={disabled || isBusy} type="submit">
            Add Block
          </button>
          {disabled ? <span className="warning-text">Only draft/review versions can be edited.</span> : null}
          {message ? <span className="danger-text">{message}</span> : null}
        </div>
      </form>
    </details>
  );
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonObject(value: FormDataEntryValue | null): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(String(value ?? "{}"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Metadata must be a JSON object" };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Metadata JSON is invalid" };
  }
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
