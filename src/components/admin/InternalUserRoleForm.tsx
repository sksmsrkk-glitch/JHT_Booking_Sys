/**
 * @file 한글 책임: `Internal User Role Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { CompanyListItem } from "@/features/company/types";
import { MANAGEABLE_INTERNAL_ROLES } from "@/lib/domain/internal-users.mjs";

export function InternalUserRoleForm({ companies }: { companies: CompanyListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function saveUser(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authUserId: String(formData.get("authUserId") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        displayName: String(formData.get("displayName") ?? "").trim(),
        companyId: String(formData.get("companyId") ?? "").trim(),
        roles: formData.getAll("roles").map((role) => String(role))
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Internal user update failed");
      setIsBusy(false);
      return;
    }

    requestRouteRefresh();
  }

  return (
    <form action={saveUser} className="stacked-form">
      <div className="form-grid two-column">
        <label>
          Supabase Auth User ID
          <input disabled={isBusy} name="authUserId" required />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" required type="email" />
        </label>
        <label>
          Display Name
          <input disabled={isBusy} name="displayName" />
        </label>
        <label>
          Default Company
          <select disabled={isBusy} name="companyId">
            <option value="">Not set</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} - {company.nameKo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="checkbox-group" disabled={isBusy}>
        <legend>Internal Roles</legend>
        {MANAGEABLE_INTERNAL_ROLES.map((role) => (
          <label key={role}>
            <input name="roles" type="checkbox" value={role} />
            <span>{formatLabel(role)}</span>
          </label>
        ))}
      </fieldset>

      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Save Internal User
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
