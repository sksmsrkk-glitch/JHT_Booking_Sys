/**
 * @file 한글 책임: Next.js App Router의 `/admin/users` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { InternalUserRoleForm } from "@/components/admin/InternalUserRoleForm";
import type { CompanyListItem } from "@/features/company/types";
import type { InternalUserListItem } from "@/features/internal-users/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; users: InternalUserListItem[]; companies: CompanyListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminUsersPage() {
  const loadState = await loadUsers();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Internal Users</h1>
          <p>Register Supabase Auth users as internal profiles and manage role-based access.</p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Add or Update Internal User</h2>
            <p>Only admin users can manage internal roles. Create the Supabase Auth user first.</p>
          </div>
          <span>Admin only</span>
        </div>
        <InternalUserRoleForm companies={loadState.status === "ready" ? loadState.companies : []} />
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Admin role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Internal users could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <InternalUsersTable companies={loadState.companies} users={loadState.users} />
      ) : null}
    </>
  );
}

function InternalUsersTable({ users, companies }: { users: InternalUserListItem[]; companies: CompanyListItem[] }) {
  if (users.length === 0) {
    return (
      <section className="empty-state">
        <h2>No internal users</h2>
        <p>Use bootstrap or this form to create the first internal profile and roles.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Internal users">
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Status</th>
            <th>Roles</th>
            <th>Default Company</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>
                <strong>{user.displayName ?? user.email}</strong>
                <span className="subtext">{user.email}</span>
                <span className="subtext">{user.id}</span>
              </td>
              <td>
                <span className={`status-dot status-${user.status}`}>{formatLabel(user.status)}</span>
              </td>
              <td>{user.roles.length > 0 ? user.roles.map(formatLabel).join(", ") : "No roles"}</td>
              <td>{formatCompany(user.defaultCompanyId, companies)}</td>
              <td>{formatDateTime(user.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadUsers(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "auth-required", message: "This page requires a Supabase user JWT with admin role." };
  }

  const [userResponse, companyResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/admin/users", headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/companies", headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [userPayload, companyPayload] = await Promise.all([userResponse.json(), companyResponse.json()]);

  const failedResponse = [userResponse, companyResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: userPayload.error ?? companyPayload.error ?? "Unknown internal user API error"
    };
  }

  return { status: "ready", users: userPayload.data ?? [], companies: companyPayload.data ?? [] };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatCompany(companyId: string | null, companies: CompanyListItem[]) {
  if (!companyId) return "Not set";
  const company = companies.find((item) => item.id === companyId);
  return company ? `${company.code} - ${company.nameKo}` : companyId;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
