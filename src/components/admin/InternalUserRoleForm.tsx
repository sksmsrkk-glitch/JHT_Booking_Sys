"use client";

import { useState } from "react";
import type { CompanyListItem } from "@/features/company/types";
import { MANAGEABLE_INTERNAL_ROLES } from "@/lib/domain/internal-users.mjs";

export function InternalUserRoleForm({ companies }: { companies: CompanyListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function saveUser(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/users", {
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

    window.location.reload();
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
