/**
 * @file 한글 책임: `Migration Batch Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

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
    const response = await safeFetch(`/api/migrations/notion-csv/batches/${batchId}/status`, {
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
