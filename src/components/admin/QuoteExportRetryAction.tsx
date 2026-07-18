/**
 * @file 한글 책임: `Quote Export Retry Action` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteExportRetryAction({ exportId, status }: { exportId: string; status: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const canRetry = status === "failed";

  async function retryExport() {
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch(`/api/quote-exports/${exportId}/retry`, {
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
