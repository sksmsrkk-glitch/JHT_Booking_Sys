import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordRecoveryRequestForm } from "@/components/auth/PasswordRecoveryRequestForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  if ((await searchParams).portal === "agency") redirect("/agency/forgot-password");
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Account Recovery</p>
          <h1>Reset password</h1>
          <p>We will send a one-time recovery link to the registered account email.</p>
        </div>
        <Link className="button-secondary" href={"/auth/login" as Route}>Back to Log In</Link>
      </div>
      <PasswordRecoveryRequestForm accountType="internal" />
    </>
  );
}
