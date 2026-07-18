/**
 * @file 한글 책임: `Settlement Status Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function SettlementStatusActions({ settlementId, status }: { settlementId: string; status: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const actions = getActions(status);

  async function updateStatus(nextStatus: string) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/finance/settlements/${settlementId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Settlement update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  if (actions.length === 0) {
    return <span className="subtext">Locked</span>;
  }

  return (
    <div className="inline-actions">
      {actions.map((action) => (
        <button
          className={action.variant === "primary" ? "button-primary" : "button-secondary"}
          disabled={isBusy}
          key={action.status}
          onClick={() => updateStatus(action.status)}
          type="button"
        >
          {action.label}
        </button>
      ))}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

function getActions(status: string) {
  if (status === "draft") {
    return [
      { status: "review", label: "Review", variant: "secondary" },
      { status: "approved", label: "Approve", variant: "primary" }
    ];
  }

  if (status === "review") {
    return [
      { status: "draft", label: "Back to Draft", variant: "secondary" },
      { status: "approved", label: "Approve", variant: "primary" }
    ];
  }

  if (status === "approved") {
    return [{ status: "closed", label: "Close", variant: "primary" }];
  }

  return [];
}
