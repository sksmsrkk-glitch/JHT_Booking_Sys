/**
 * @file 한글 책임: Next.js App Router의 `/auth/login` 화면 또는 라우트 레이아웃을 구성합니다.
 * 인증 또는 공용 사용자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { SupabaseLoginForm } from "@/components/auth/SupabaseLoginForm";
import { resolvePostLoginPath } from "@/lib/domain/auth-session.mjs";

type SearchParams = Promise<{ next?: string; reset?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const resetComplete = params.reset === "complete";
  const redirectTo = resolvePostLoginPath("internal", params.next);
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Session</p>
          <h1>Internal Log In</h1>
          <p>JHT team members sign in here. Internal pages require an active Supabase user with an internal role.</p>
        </div>
      </div>
      {resetComplete ? <section className="notice compact"><p>Password updated. Log in with your new password.</p></section> : null}
      <SupabaseLoginForm accountType="internal" buttonLabel="Log In" pendingLabel="Logging in..." redirectTo={redirectTo} />
    </>
  );
}
