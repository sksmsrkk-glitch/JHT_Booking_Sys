/**
 * @file 한글 책임: `Company Create Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
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
