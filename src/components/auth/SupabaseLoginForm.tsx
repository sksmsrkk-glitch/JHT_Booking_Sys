"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "next";
import Link from "next/link";
import { safeFetch } from "@/lib/client/safe-fetch";

type SupabaseLoginFormProps = {
  buttonLabel: string;
  pendingLabel: string;
  redirectTo: string;
  accountType: "internal" | "agency";
};

export function SupabaseLoginForm({ accountType, buttonLabel, pendingLabel, redirectTo }: SupabaseLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const forgotEmailHref = accountType === "agency" ? "/agency/forgot-email" : "/auth/forgot-email";
  const forgotPasswordHref = accountType === "agency" ? "/agency/forgot-password" : "/auth/forgot-password";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setMessage("Supabase public environment variables are not configured.");
      setIsSubmitting(false);
      return;
    }

    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setMessage(error?.message ?? "Login failed");
      setIsSubmitting(false);
      return;
    }

    const sessionResponse = await safeFetch("/auth/session", {
      body: JSON.stringify({
        accessToken: data.session.access_token,
        expiresIn: data.session.expires_in,
        refreshToken: data.session.refresh_token
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    if (!sessionResponse.ok) {
      const payload = await sessionResponse.json().catch(() => null);
      setMessage(payload?.error ?? "Session cookie could not be created");
      setIsSubmitting(false);
      return;
    }

    window.location.assign(redirectTo);
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <label>
        Email
        <input
          autoComplete="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label>
        Password
        <input
          autoComplete="current-password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? pendingLabel : buttonLabel}
      </button>
      <div className="auth-recovery-links" aria-label="Account recovery">
        <Link href={forgotEmailHref as Route}>Forgot email?</Link>
        <Link href={forgotPasswordHref as Route}>Forgot password?</Link>
      </div>
      {message ? <p className="danger-text">{message}</p> : null}
    </form>
  );
}
