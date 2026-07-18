"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";

export function CompanyCreateForm() {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: String(formData.get("code") ?? "").trim(),
        nameKo: String(formData.get("nameKo") ?? "").trim(),
        nameEn: String(formData.get("nameEn") ?? "").trim()
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Company creation failed");
      setIsBusy(false);
      return;
    }

    requestRouteRefresh();
  }

  return (
    <form action={submit} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Company Code
          <input disabled={isBusy} maxLength={20} name="code" placeholder="JHT" required />
        </label>
        <label>
          Name KO
          <input disabled={isBusy} name="nameKo" placeholder="Jungho Travel Korea name" required />
        </label>
        <label>
          Name EN
          <input disabled={isBusy} name="nameEn" placeholder="Jungho Travel" required />
        </label>
      </div>
      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Add Company
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}
