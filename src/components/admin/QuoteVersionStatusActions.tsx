/**
 * @file 한글 책임: `Quote Version Status Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteVersionStatusActions({
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

  async function updateStatus(nextStatus: "sent" | "accepted" | "cancelled") {
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch(`/api/quote-versions/${quoteVersionId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  const canSend = ["draft", "review"].includes(status) && publicTotalAmount > 0;
  const canAccept = status === "sent";
  const canCancel = ["draft", "review", "sent"].includes(status);

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={!canSend || isBusy} onClick={() => updateStatus("sent")} type="button">
        Send to Agency
      </button>
      <button
        className="button-secondary"
        disabled={!canAccept || isBusy}
        onClick={() => updateStatus("accepted")}
        type="button"
      >
        Mark Accepted
      </button>
      <button
        className="button-secondary danger-button"
        disabled={!canCancel || isBusy}
        onClick={() => updateStatus("cancelled")}
        type="button"
      >
        Cancel Version
      </button>
      {status === "draft" && publicTotalAmount <= 0 ? (
        <span className="warning-text">Add at least one priced item before sending.</span>
      ) : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
