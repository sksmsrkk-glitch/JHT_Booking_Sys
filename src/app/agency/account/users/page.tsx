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
