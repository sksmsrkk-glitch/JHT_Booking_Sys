/**
 * @file 한글 책임: Next.js App Router의 `/auth/forgot-email` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmailRecoveryForm } from "@/components/auth/EmailRecoveryForm";

type SearchParams = Promise<{ portal?: string }>;

export default async function ForgotEmailPage({ searchParams }: { searchParams: SearchParams }) {
  if ((await searchParams).portal === "agency") redirect("/agency/forgot-email");
  return (
    <>
      <div className="page-header recovery-page-header">
        <div>
          <p className="eyebrow">Account Recovery</p>
          <h1>Find account email</h1>
          <p>Enter the exact information registered with JHT. Only a masked email address can be displayed.</p>
        </div>
        <Link className="button-secondary" href={"/auth/login" as Route}>Back to Log In</Link>
      </div>
      <EmailRecoveryForm accountType="internal" />
    </>
  );
}
