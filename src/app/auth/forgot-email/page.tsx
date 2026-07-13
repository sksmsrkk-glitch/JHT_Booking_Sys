import type { Route } from "next";
import Link from "next/link";
import { EmailRecoveryForm } from "@/components/auth/EmailRecoveryForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ForgotEmailPage({ searchParams }: { searchParams: SearchParams }) {
  const accountType = (await searchParams).portal === "agency" ? "agency" : "internal";
  const loginHref = accountType === "agency" ? "/agency/login" : "/auth/login";
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Account Recovery</p>
          <h1>Find account email</h1>
          <p>Enter the exact information registered with JHT. Only a masked email address can be displayed.</p>
        </div>
        <Link className="button-secondary" href={loginHref as Route}>Back to Log In</Link>
      </div>
      <EmailRecoveryForm accountType={accountType} />
    </>
  );
}
