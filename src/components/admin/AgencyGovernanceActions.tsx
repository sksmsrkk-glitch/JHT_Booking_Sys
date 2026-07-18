/**
 * @file 한글 책임: `Agency Governance Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { AgencyLifecycleStatus, AgencySignupApplication } from "@/features/agency/types";

export function AgencySignupApplicationActions({ application }: { application: AgencySignupApplication }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function decide(decision: "approve" | "reject", formData?: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch(`/api/agency/signup-applications/${application.id}/decision`, {
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
    requestRouteRefresh();
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
    const response = await safeFetch(`/api/agencies/${agencyId}/lifecycle`, {
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
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "active"} onClick={() => update("active")} type="button">
        Reactivate
      </button>
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "frozen"} onClick={() => update("frozen")} type="button">
        Freeze
      </button>
      <button className="button-secondary" disabled={isBusy || lifecycleStatus === "withdrawn"} onClick={() => update("withdrawn")} type="button">
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
    const response = await safeFetch(`/api/agencies/${agencyId}/users/${userId}`, {
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
    requestRouteRefresh();
  }

  return (
    <div className="inline-actions">
      <button className="button-secondary" disabled={isBusy} onClick={() => patch({ passwordResetRequired: true })} type="button">
        Reset PW
      </button>
      <button className="button-secondary" disabled={isBusy} onClick={() => patch({ status: "inactive" })} type="button">
        Force Withdraw
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </div>
  );
}
