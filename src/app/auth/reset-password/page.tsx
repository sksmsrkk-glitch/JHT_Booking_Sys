/**
 * @file 한글 책임: Next.js App Router의 `/auth/reset-password` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
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
