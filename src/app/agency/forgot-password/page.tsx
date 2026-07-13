import type { Route } from "next";
import Link from "next/link";
import { PasswordRecoveryRequestForm } from "@/components/auth/PasswordRecoveryRequestForm";

export default function AgencyForgotPasswordPage() {
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Partner Account Recovery</p>
          <h1>Reset password</h1>
          <p>We will send a one-time recovery link to the email registered for this partner account.</p>
        </div>
        <Link className="button-secondary" href={"/agency/login" as Route}>Back to Log In</Link>
      </div>
      <PasswordRecoveryRequestForm accountType="agency" />
    </>
  );
}
