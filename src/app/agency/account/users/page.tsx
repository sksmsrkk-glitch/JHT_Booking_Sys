/**
 * @file 한글 책임: Next.js App Router의 `/agency/account/users` 화면 또는 라우트 레이아웃을 구성합니다.
 * 해외 파트너에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import { AgencyUserManagement } from "@/components/agency/AgencyUserManagement";
import { buildInternalApiUrl, getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

export default async function AgencyUsersPage() {
  const pageHeader = (
    <div className="page-header">
      <div>
        <p className="eyebrow">Partner Account</p>
        <h1>User Management</h1>
        <p>Mother accounts can invite, disable, reactivate, and reset passwords for sub accounts.</p>
      </div>
    </div>
  );
  const { authorization, headerStore } = await getPageAuthorization();
  if (!authorization) {
    return <>{pageHeader}<section className="notice"><h2>Login required</h2><p>Sign in with an approved partner account to manage portal users.</p></section></>;
  }

  const response = await fetch(buildInternalApiUrl("/api/agency/users", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) {
    return <>{pageHeader}<section className="notice"><h2>Account users could not load</h2><p>{payload.error ?? "Partner account access is required."}</p></section></>;
  }

  return (
    <>
      {pageHeader}
      <AgencyUserManagement users={payload.data.users} canManage={payload.data.canManage} actorUserId={payload.data.actorUserId} />
    </>
  );
}
