"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type SupabaseLoginFormProps = {
  buttonLabel: string;
  pendingLabel: string;
  redirectTo: string;
};

export function SupabaseLoginForm({ buttonLabel, pendingLabel, redirectTo }: SupabaseLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    const sessionResponse = await fetch("/auth/session", {
      body: JSON.stringify({
        accessToken: data.session.access_token,
        expiresIn: data.session.expires_in
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

    window.location.href = redirectTo;
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
      {message ? <p className="danger-text">{message}</p> : null}
    </form>
  );
}
