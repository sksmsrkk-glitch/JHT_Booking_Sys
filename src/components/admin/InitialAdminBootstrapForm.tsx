"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { useState } from "react";

export function InitialAdminBootstrapForm() {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function bootstrap(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    const response = await safeFetch("/api/admin/bootstrap", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bootstrap-secret": String(formData.get("bootstrapSecret") ?? "")
      },
      body: JSON.stringify({
        authUserId: String(formData.get("authUserId") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        displayName: String(formData.get("displayName") ?? "").trim(),
        companyCode: String(formData.get("companyCode") ?? "").trim(),
        companyNameKo: String(formData.get("companyNameKo") ?? "").trim(),
        companyNameEn: String(formData.get("companyNameEn") ?? "").trim()
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Bootstrap failed");
      setIsBusy(false);
      return;
    }

    setMessage(`Created ${payload.data.profile?.email ?? "admin"} with ${payload.data.company?.code ?? "JHT"} company and admin/finance roles.`);
    setIsBusy(false);
  }

  return (
    <form action={bootstrap} className="stacked-form">
      <div className="form-grid two-column">
        <label>
          Bootstrap Secret
          <input autoComplete="off" disabled={isBusy} name="bootstrapSecret" required type="password" />
        </label>
        <label>
          Supabase Auth User ID
          <input disabled={isBusy} name="authUserId" placeholder="UUID from auth.users" required />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" required type="email" />
        </label>
        <label>
          Display Name
          <input disabled={isBusy} name="displayName" placeholder="Jungho Admin" />
        </label>
      </div>
      <label className="full-width-field">
        Company Code
        <input defaultValue="JHT" disabled={isBusy} name="companyCode" required />
      </label>
      <div className="form-grid two-column">
        <label>
          Company Name Ko
          <input defaultValue="정호여행사" disabled={isBusy} name="companyNameKo" required />
        </label>
        <label>
          Company Name En
          <input defaultValue="Jungho Travel" disabled={isBusy} name="companyNameEn" required />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Create Initial Admin
        </button>
        {message ? <span className={message.includes("failed") ? "danger-text" : "success-text"}>{message}</span> : null}
      </div>
    </form>
  );
}
