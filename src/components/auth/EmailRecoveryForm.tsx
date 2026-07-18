/**
 * @file 한글 책임: `Email Recovery Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { FormEvent, useState } from "react";
import { safeFetch } from "@/lib/client/safe-fetch";

type RecoveryResult = { status?: string; maskedEmail?: string; message?: string };

export function EmailRecoveryForm({ accountType }: { accountType: "internal" | "agency" }) {
  const [result, setResult] = useState<RecoveryResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    const formData = new FormData(event.currentTarget);
    const response = await safeFetch("/api/auth/forgot-email", {
      body: JSON.stringify({
        accountType,
        companyName: formData.get("companyName"),
        contactName: formData.get("contactName"),
        phone: formData.get("phone")
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setResult(response.ok ? payload?.data : { message: payload?.error ?? "Email recovery request failed." });
    setIsSubmitting(false);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <label>
        {accountType === "agency" ? "Partner company name" : "JHT company / department"}
        <input name="companyName" required type="text" />
      </label>
      <label>
        Full name
        <input autoComplete="name" name="contactName" required type="text" />
      </label>
      <label>
        Registered phone number
        <input autoComplete="tel" name="phone" required type="tel" />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Checking..." : "Find account email"}
      </button>
      {result?.maskedEmail ? (
        <div className="auth-recovery-result" role="status">
          <span>Matching account</span>
          <strong>{result.maskedEmail}</strong>
          <p>Use the password recovery screen if you also need to reset the password.</p>
        </div>
      ) : result?.message ? <p className="auth-form-message" role="status">{result.message}</p> : null}
    </form>
  );
}
