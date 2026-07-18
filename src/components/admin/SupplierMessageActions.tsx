/**
 * @file 한글 책임: `Supplier Message Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function SupplierMessageActions({
  messageId,
  messageType,
  status,
  approvedAt,
  secondApprovedAt
}: {
  messageId: string;
  messageType: string;
  status: string;
  approvedAt: string | null;
  secondApprovedAt: string | null;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const needsSecondApproval = messageType === "cancellation_request" && approvedAt && !secondApprovedAt;
  const canApprove = ["draft", "pending_approval", "approved"].includes(status);
  const canQueue = !["queued", "sending", "sent"].includes(status);
  const canRequeue = status === "failed";

  async function approve(secondApproval = false) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/supplier-messages/${messageId}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secondApproval })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Approval failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  async function queueSend() {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/supplier-messages/${messageId}/${canRequeue ? "requeue" : "send"}`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? (canRequeue ? "Requeue failed" : "Queue send failed"));
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      {!approvedAt && canApprove ? (
        <button className="button-secondary" disabled={isBusy} onClick={() => approve(false)} type="button">
          Approve
        </button>
      ) : null}
      {needsSecondApproval ? (
        <button className="button-secondary" disabled={isBusy} onClick={() => approve(true)} type="button">
          2nd Approve
        </button>
      ) : null}
      <button className="button-secondary" disabled={isBusy || !canQueue} onClick={queueSend} type="button">
        {canRequeue ? "Requeue" : "Queue"}
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
