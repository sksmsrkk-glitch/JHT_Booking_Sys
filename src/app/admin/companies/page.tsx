import type { Route } from "next";
import Link from "next/link";
import { CompanyCreateForm } from "@/components/admin/CompanyCreateForm";
import type { CompanyListItem } from "@/features/company/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; companies: CompanyListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminCompaniesPage() {
  const loadState = await loadCompanies();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Companies</h1>
          <p>Manage operating company records used by agencies, suppliers, quotes, and internal users.</p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Add Company</h2>
            <p>Company codes are normalized to uppercase and must stay unique.</p>
          </div>
          <span>Admin only</span>
        </div>
        <CompanyCreateForm />
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Admin role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Company data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <CompaniesTable companies={loadState.companies} /> : null}
    </>
  );
}

function CompaniesTable({ companies }: { companies: CompanyListItem[] }) {
  if (companies.length === 0) {
    return (
      <section className="empty-state">
        <h2>No companies</h2>
        <p>Create the operating company before adding agencies, suppliers, or internal users.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Companies">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Korean Name</th>
            <th>English Name</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => (
            <tr key={company.id}>
              <td>
                <strong>{company.code}</strong>
                <span className="subtext">{company.id}</span>
              </td>
              <td>{company.nameKo}</td>
              <td>{company.nameEn}</td>
              <td>
                <span className={`status-dot status-${company.status}`}>{formatLabel(company.status)}</span>
              </td>
              <td>{company.updatedAt ? formatDateTime(company.updatedAt) : "Not set"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadCompanies(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return { status: "auth-required", message: "This page requires a Supabase user JWT with admin role." };
  }

  const response = await fetch(buildInternalApiUrl("/api/companies", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown company API error"
    };
  }

  return { status: "ready", companies: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  url.searchParams.set("status", "all");
  return url;
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
