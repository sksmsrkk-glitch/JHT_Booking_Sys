/**
 * @file 한글 책임: `Password Recovery Request Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { FormEvent, useState } from "react";
import { safeFetch } from "@/lib/client/safe-fetch";

export function PasswordRecoveryRequestForm({ accountType }: { accountType: "internal" | "agency" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const response = await safeFetch("/api/auth/forgot-password", {
      body: JSON.stringify({ accountType, email }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const payload = await response.json().catch(() => null);
    setMessage(payload?.data?.message ?? payload?.error ?? "Password recovery request failed.");
    setIsSubmitting(false);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <label>
        Account email
        <input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          required
          type="email"
          value={email}
        />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending..." : "Send reset link"}
      </button>
      {message ? <p className="auth-form-message" role="status">{message}</p> : null}
    </form>
  );
}
