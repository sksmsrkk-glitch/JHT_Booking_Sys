/**
 * @file 한글 책임: `Quote Version Export Action` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

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

    const response = await safeFetch(`/api/quote-versions/${quoteVersionId}/export-xlsx`, {
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
