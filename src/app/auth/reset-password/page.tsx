import { PasswordResetForm } from "@/components/auth/PasswordResetForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const accountType = (await searchParams).portal === "agency" ? "agency" : "internal";
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Secure Recovery</p>
          <h1>Set a new password</h1>
          <p>The recovery link is single-use and expires according to the Supabase Auth policy.</p>
        </div>
      </div>
      <PasswordResetForm accountType={accountType} />
    </>
  );
}
