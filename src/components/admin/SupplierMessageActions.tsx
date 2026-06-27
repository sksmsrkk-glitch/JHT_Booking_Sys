"use client";

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
    const response = await fetch(`/api/supplier-messages/${messageId}/approve`, {
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
    window.location.reload();
  }

  async function queueSend() {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/supplier-messages/${messageId}/${canRequeue ? "requeue" : "send"}`, {
      method: "POST"
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? (canRequeue ? "Requeue failed" : "Queue send failed"));
      setIsBusy(false);
      return;
    }
    window.location.reload();
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
