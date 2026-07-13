import type { Route } from "next";
import Link from "next/link";
import { PasswordRecoveryRequestForm } from "@/components/auth/PasswordRecoveryRequestForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const accountType = resolveAccountType((await searchParams).portal);
  const loginHref = accountType === "agency" ? "/agency/login" : "/auth/login";
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Account Recovery</p>
          <h1>Reset password</h1>
          <p>We will send a one-time recovery link to the registered account email.</p>
        </div>
        <Link className="button-secondary" href={loginHref as Route}>Back to Log In</Link>
      </div>
      <PasswordRecoveryRequestForm accountType={accountType} />
    </>
  );
}

function resolveAccountType(value?: string): "internal" | "agency" {
  return value === "agency" ? "agency" : "internal";
}
