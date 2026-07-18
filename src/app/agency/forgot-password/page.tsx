/**
 * @file 한글 책임: Next.js App Router의 `/agency/forgot-password` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
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
