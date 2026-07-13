import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

export default function AgencyResetPasswordPage() {
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Partner Secure Recovery</p>
          <h1>Set a new password</h1>
          <p>The recovery link is single-use and expires according to the Supabase Auth policy.</p>
        </div>
      </div>
      <PasswordResetForm accountType="agency" />
    </>
  );
}
