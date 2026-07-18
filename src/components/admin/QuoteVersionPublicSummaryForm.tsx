/**
 * @file 한글 책임: `Quote Version Public Summary Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteVersionPublicSummaryForm({
  agencyVisibleSummary,
  disabled,
  excelSourceSummary,
  publicFareOptions,
  quoteVersionId,
  termsAndConditions
}: {
  agencyVisibleSummary: Record<string, unknown>;
  disabled: boolean;
  excelSourceSummary: Record<string, unknown>;
  publicFareOptions: Record<string, unknown>[];
  quoteVersionId: string;
  termsAndConditions: string | null;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    let payload;
    try {
      payload = {
        agencyVisibleSummary: parseJsonObject(formData.get("agencyVisibleSummary")),
        publicFareOptions: parseJsonArray(formData.get("publicFareOptions")),
        excelSourceSummary: parseJsonObject(formData.get("excelSourceSummary")),
        termsAndConditions: String(formData.get("termsAndConditions") ?? "")
      };
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invalid JSON");
      setIsBusy(false);
      return;
    }

    const response = await safeFetch(`/api/quote-versions/${quoteVersionId}/public-summary`, {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Public summary update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <details className="row-details">
      <summary>Public fare options and Excel source</summary>
      <form action={submit} className="stacked-form">
        <label className="full-width-field">
          Public Fare Options JSON
          <textarea
            defaultValue={JSON.stringify(publicFareOptions, null, 2)}
            disabled={disabled || isBusy}
            name="publicFareOptions"
            rows={6}
          />
        </label>
        <label className="full-width-field">
          Agency Visible Summary JSON
          <textarea
            defaultValue={JSON.stringify(agencyVisibleSummary, null, 2)}
            disabled={disabled || isBusy}
            name="agencyVisibleSummary"
            rows={5}
          />
        </label>
        <label className="full-width-field">
          Excel Source Summary JSON
          <textarea
            defaultValue={JSON.stringify(excelSourceSummary, null, 2)}
            disabled={disabled || isBusy}
            name="excelSourceSummary"
            rows={5}
          />
        </label>
        <label className="full-width-field">
          Terms And Conditions
          <textarea defaultValue={termsAndConditions ?? ""} disabled={disabled || isBusy} name="termsAndConditions" rows={4} />
        </label>
        <div className="inline-actions">
          <button className="button-secondary" disabled={disabled || isBusy} type="submit">
            Save Public Summary
          </button>
          {disabled ? <span className="warning-text">Only draft/review versions can be edited.</span> : null}
          {message ? <span className="danger-text">{message}</span> : null}
        </div>
      </form>
    </details>
  );
}

function parseJsonObject(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return {};
  const parsed = JSON.parse(normalized);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed;
}

function parseJsonArray(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return [];
  const parsed = JSON.parse(normalized);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array");
  }
  return parsed;
}
