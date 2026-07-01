"use client";

import { useState } from "react";
import type { AgencyLifecycleStatus, AgencySignupApplication } from "@/features/agency/types";

export function AgencySignupApplicationActions({ application }: { application: AgencySignupApplication }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function decide(decision: "approve" | "reject", formData?: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/agency/signup-applications/${application.id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision,
        rejectionReason: String(formData?.get("rejectionReason") ?? "").trim()
      })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Application update failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="stacked-form compact-form">
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="button" onClick={() => decide("approve")}>
          Approve
        </button>
      </div>
      <form action={(formData) => decide("reject", formData)} className="inline-actions">
        <input disabled={isBusy} name="rejectionReason" placeholder="Reject reason" />
        <button className="button-secondary" disabled={isBusy} type="submit">
          Reject
        </button>
      </form>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

export function AgencyLifecycleActions({
  agencyId,
  lifecycleStatus
}: {
  agencyId: string;
  lifecycleStatus: AgencyLifecycleStatus;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function update(status: AgencyLifecycleStatus) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/agencies/${agencyId}/lifecycle`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifecycleStatus: status })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Status update failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "active"} onClick={() => update("active")}>
        Reactivate
      </button>
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "frozen"} onClick={() => update("frozen")}>
        Freeze
      </button>
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "withdrawn"} onClick={() => update("withdrawn")}>
        Withdraw
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}

export function AgencyUserGovernanceActions({ agencyId, userId }: { agencyId: string; userId: string }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function patch(payload: Record<string, unknown>) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch(`/api/agencies/${agencyId}/users/${userId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "User update failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isBusy} onClick={() => patch({ passwordResetRequired: true })}>
        Reset PW
      </button>
      <button className="button-secondary" disabled={isBusy} onClick={() => patch({ status: "inactive" })}>
        Force Withdraw
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
