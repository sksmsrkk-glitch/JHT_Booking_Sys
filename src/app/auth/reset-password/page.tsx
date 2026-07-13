import { redirect } from "next/navigation";
import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  if ((await searchParams).portal === "agency") redirect("/agency/reset-password");
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Secure Recovery</p>
          <h1>Set a new password</h1>
          <p>The recovery link is single-use and expires according to the Supabase Auth policy.</p>
        </div>
      </div>
      <PasswordResetForm accountType="internal" />
    </>
  );
}
