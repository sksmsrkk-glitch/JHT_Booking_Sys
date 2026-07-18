"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient, type Session } from "@supabase/supabase-js";
import { validateRecoveryPassword } from "@/lib/domain/account-recovery.mjs";
import { safeFetch } from "@/lib/client/safe-fetch";

export function PasswordResetForm({ accountType }: { accountType: "internal" | "agency" }) {
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Validating your secure recovery link...");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    return url && anonKey ? createClient(url, anonKey) : null;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setMessage("Supabase public environment variables are not configured.");
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setMessage(data.session ? "Enter a new password for this account." : "This recovery link is invalid or has expired.");
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted || (event !== "PASSWORD_RECOVERY" && !nextSession)) return;
      setSession(nextSession);
      setMessage(nextSession ? "Enter a new password for this account." : "This recovery link is invalid or has expired.");
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session) return;
    const validationMessage = validateRecoveryPassword(password);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
      setIsSubmitting(false);
      return;
    }
    await safeFetch("/api/auth/password-reset-complete", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      method: "POST"
    });
    await supabase.auth.signOut();
    window.location.href = accountType === "agency" ? "/agency/login?reset=complete" : "/auth/login?reset=complete";
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <p className="auth-form-message" role="status">{message}</p>
      <label>
        New password
        <input
          autoComplete="new-password"
          disabled={!session || isSubmitting}
          minLength={12}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <label>
        Confirm new password
        <input
          autoComplete="new-password"
          disabled={!session || isSubmitting}
          minLength={12}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          type="password"
          value={confirmPassword}
        />
      </label>
      <p className="subtext">Use 12+ characters with uppercase, lowercase, number, and special character.</p>
      <button className="button-primary" disabled={!session || isSubmitting} type="submit">
        {isSubmitting ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}
