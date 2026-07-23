/**
 * @file 한글 책임: `Quote Itinerary Day Create Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { LocaleDateInput } from "@/components/LocaleDateInput";
import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteItineraryDayCreateForm({
  quoteVersionId,
  disabledReason,
  nextDayNo
}: {
  quoteVersionId: string | null;
  disabledReason?: string;
  nextDayNo: number;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    if (!quoteVersionId) return;
    setIsBusy(true);
    setMessage("");

    const mealSummary = parseMealSummary(String(formData.get("mealSummary") ?? ""));
    if (!mealSummary.ok) {
      setMessage(mealSummary.message);
      setIsBusy(false);
      return;
    }

    const response = await safeFetch(`/api/quote-versions/${quoteVersionId}/itinerary-days`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dayNo: normalizeOptionalNumber(formData.get("dayNo")),
        serviceDate: normalizeOptionalString(formData.get("serviceDate")),
        title: normalizeOptionalString(formData.get("title")),
        mealSummary: mealSummary.value,
        publicDescription: String(formData.get("publicDescription") ?? "").trim(),
        internalNotes: normalizeOptionalString(formData.get("internalNotes"))
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Itinerary day creation failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={submit} className="stacked-form">
      {disabledReason ? <p className="warning-text">{disabledReason}</p> : null}
      <div className="form-grid three-column">
        <label>
          Day No.
          <input
            defaultValue={nextDayNo}
            disabled={!quoteVersionId || isBusy}
            min="1"
            name="dayNo"
            step="1"
            type="number"
          />
        </label>
        <label>
          Service Date
          <LocaleDateInput disabled={!quoteVersionId || isBusy} name="serviceDate" />
        </label>
        <label>
          Title
          <input disabled={!quoteVersionId || isBusy} name="title" placeholder="Arrival and transfer" />
        </label>
      </div>
      <label className="full-width-field">
        Public Description
        <textarea
          disabled={!quoteVersionId || isBusy}
          name="publicDescription"
          placeholder="Customer-visible itinerary description"
          required
          rows={3}
        />
      </label>
      <label className="full-width-field">
        Meal Summary JSON
        <textarea
          defaultValue={`{"breakfast":false,"lunch":false,"dinner":false}`}
          disabled={!quoteVersionId || isBusy}
          name="mealSummary"
          rows={2}
        />
      </label>
      <label className="full-width-field">
        Internal Notes
        <textarea disabled={!quoteVersionId || isBusy} name="internalNotes" rows={2} />
      </label>
      <div className="inline-actions">
        <button className="button-primary" disabled={!quoteVersionId || isBusy} type="submit">
          Add Itinerary Day
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function parseMealSummary(value: string): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  if (!value.trim()) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, message: "Meal summary must be a JSON object" };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, message: "Meal summary JSON is invalid" };
  }
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
