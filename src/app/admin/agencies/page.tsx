import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { AGENCY_RECORD_STATUSES } from "@/features/agency/queries";
import type { AgencyListItem } from "@/features/agency/types";
import { AgencyCreateForm } from "@/components/admin/MasterDataCreateForms";
import type { CompanyListItem } from "@/features/company/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  country?: string;
  status?: string;
}>;

type LoadState =
  | { status: "ready"; agencies: AgencyListItem[]; companies: CompanyListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminAgenciesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadAgencies(filters);
  const selectedStatus = filters.status ?? "active";

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Overseas Agencies</h1>
          <p>
            Foreign agency customer accounts, contacts, portal users, and inquiry history.
            This workspace uses `agency_*` tables only.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/agencies">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Agency, domain, country"
          />
        </label>
        <label>
          Country
          <input name="country" defaultValue={filters.country ?? ""} placeholder="MY, VN, JP" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={selectedStatus}>
            {AGENCY_RECORD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Add Overseas Agency</h2>
          <span>Agency account</span>
        </div>
        <AgencyCreateForm companies={loadState.status === "ready" ? loadState.companies : []} />
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Agency data could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <AgencyTable agencies={loadState.agencies} /> : null}
    </>
  );
}

function AgencyTable({ agencies }: { agencies: AgencyListItem[] }) {
  if (agencies.length === 0) {
    return (
      <section className="empty-state">
        <h2>No overseas agencies found</h2>
        <p>Add agency customer data or adjust the current filters.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Overseas agency list">
      <table>
        <thead>
          <tr>
            <th>Agency</th>
            <th>Country</th>
            <th>Billing</th>
            <th>Contacts</th>
            <th>Users</th>
            <th>Inquiries</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {agencies.map((agency) => (
            <tr key={agency.id}>
              <td>
                <Link className="strong-link" href={`/admin/agencies/${agency.id}` as Route}>
                  {agency.name}
                </Link>
                {agency.emailDomain ? <span className="subtext">{agency.emailDomain}</span> : null}
              </td>
              <td>{agency.countryCode ?? "Not set"}</td>
              <td>{agency.billingCurrency}</td>
              <td>{agency.contactCount}</td>
              <td>{agency.userCount}</td>
              <td>{agency.inquiryCount}</td>
              <td>
                <span className={`status-dot status-${agency.status}`}>{formatLabel(agency.status)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadAgencies(filters: { q?: string; country?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads agency customer data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [agencyResponse, companyResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/agencies", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/companies", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [agencyPayload, companyPayload] = await Promise.all([agencyResponse.json(), companyResponse.json()]);

  const failedResponse = [agencyResponse, companyResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: agencyPayload.error ?? companyPayload.error ?? "Unknown agency API error"
    };
  }

  return { status: "ready", agencies: agencyPayload.data ?? [], companies: companyPayload.data ?? [] };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; country?: string; status?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.country) url.searchParams.set("country", filters.country);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
