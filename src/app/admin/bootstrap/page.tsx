/**
 * @file 한글 책임: Next.js App Router의 `/admin/bootstrap` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { InitialAdminBootstrapForm } from "@/components/admin/InitialAdminBootstrapForm";

const loginRoute = "/auth/login" as Route;

export default function AdminBootstrapPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Initial Setup</p>
          <h1>Admin Bootstrap</h1>
          <p>Create the first company record and internal admin/finance role after creating a Supabase Auth user.</p>
        </div>
        <Link className="button-secondary" href={loginRoute}>
          Sign In
        </Link>
      </div>

      <section className="notice warning">
        <h2>First admin only</h2>
        <p>
          This flow requires `INITIAL_ADMIN_BOOTSTRAP_SECRET`, upserts the JHT company, and is rejected after an admin role exists.
          Remove or rotate the secret after bootstrap.
        </p>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Bootstrap Internal Admin</h2>
          <span>Service role guarded</span>
        </div>
        <InitialAdminBootstrapForm />
      </section>
    </>
  );
}
