/**
 * @file 한글 책임: `Quote Version Create Action` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function QuoteVersionCreateAction({
  quoteCaseId,
  disabledReason
}: {
  quoteCaseId: string;
  disabledReason?: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function createVersion() {
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch(`/api/quote-cases/${quoteCaseId}/versions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Quote version creation failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-primary" disabled={Boolean(disabledReason) || isBusy} onClick={createVersion} type="button">
        Create New Draft Version
      </button>
      {disabledReason ? <span className="warning-text">{disabledReason}</span> : null}
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
