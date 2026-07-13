import type { Route } from "next";
import Link from "next/link";
import { EmailRecoveryForm } from "@/components/auth/EmailRecoveryForm";

export default function AgencyForgotEmailPage() {
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Partner Account Recovery</p>
          <h1>Find account email</h1>
          <p>Enter the exact partner information registered with JHT. Only a masked email address can be displayed.</p>
        </div>
        <Link className="button-secondary" href={"/agency/login" as Route}>Back to Log In</Link>
      </div>
      <EmailRecoveryForm accountType="agency" />
    </>
  );
}
