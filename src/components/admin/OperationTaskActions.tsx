"use client";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import { OPERATION_TASK_STATUSES } from "@/features/operations/queries";

export type OperationTaskSupplierOption = {
  id: string;
  nameKo: string;
  category: string;
};

export function OperationTaskActions({
  taskId,
  currentStatus,
  currentDueAt,
  currentBlockedReason,
  currentDomesticSupplierId,
  supplierOptions
}: {
  taskId: string;
  currentStatus: string;
  currentDueAt: string | null;
  currentBlockedReason: string | null;
  currentDomesticSupplierId: string | null;
  supplierOptions: OperationTaskSupplierOption[];
}) {
  const [status, setStatus] = useState(currentStatus);
  const [dueAt, setDueAt] = useState(toDatetimeLocalValue(currentDueAt));
  const [blockedReason, setBlockedReason] = useState(currentBlockedReason ?? "");
  const [domesticSupplierId, setDomesticSupplierId] = useState(currentDomesticSupplierId ?? "");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function updateTask() {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/operation-tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        dueAt,
        blockedReason,
        domesticSupplierId
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  async function sendReminder() {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/operation-tasks/${taskId}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ruleCode: "manual", message: "Manual reminder from operation task board" })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Reminder failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <div className="compact-form">
      <label>
        Status
        <select
          aria-label="Task status"
          disabled={isBusy}
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          {OPERATION_TASK_STATUSES.map((taskStatus) => (
            <option key={taskStatus} value={taskStatus}>
              {formatLabel(taskStatus)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Due
        <input disabled={isBusy} onChange={(event) => setDueAt(event.target.value)} type="datetime-local" value={dueAt} />
      </label>
      <label>
        Supplier
        <select disabled={isBusy} onChange={(event) => setDomesticSupplierId(event.target.value)} value={domesticSupplierId}>
          <option value="">Not linked</option>
          {supplierOptions.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.nameKo} ({formatLabel(supplier.category)})
            </option>
          ))}
        </select>
      </label>
      <label>
        Blocked Reason
        <input
          disabled={isBusy}
          onChange={(event) => setBlockedReason(event.target.value)}
          placeholder="Required when blocked"
          value={blockedReason}
        />
      </label>
      <div className="inline-actions">
        <button className="button-secondary" disabled={isBusy} onClick={updateTask} type="button">
          Save
        </button>
        <button className="button-secondary" disabled={isBusy} onClick={sendReminder} type="button">
          Remind
        </button>
      </div>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

function toDatetimeLocalValue(value: string | null) {
  if (!value) return "";
  return value.replace("Z", "").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
