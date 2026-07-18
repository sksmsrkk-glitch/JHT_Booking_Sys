/**
 * @file 한글 책임: `Account Recovery Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function AccountRecoveryActions({ requestId }: { requestId: string }) {
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function update(status: "resolved" | "dismissed") {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/admin/account-recovery/${requestId}`, {
      body: JSON.stringify({ resolutionNote: note, status }),
      headers: { "content-type": "application/json" },
      method: "PATCH"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setMessage(payload?.error ?? "Recovery request update failed.");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="recovery-admin-actions">
      <input
        aria-label="Resolution note"
        onChange={(event) => setNote(event.target.value)}
        placeholder="Resolution note"
        type="text"
        value={note}
      />
      <button className="button-primary mini-button" disabled={isBusy} onClick={() => update("resolved")} type="button">
        Resolve
      </button>
      <button className="button-secondary mini-button" disabled={isBusy} onClick={() => update("dismissed")} type="button">
        Dismiss
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
