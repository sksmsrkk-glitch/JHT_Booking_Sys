"use client";

import { FormEvent, useState } from "react";

export function PasswordRecoveryRequestForm({ accountType }: { accountType: "internal" | "agency" }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    const response = await fetch("/api/auth/forgot-password", {
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
