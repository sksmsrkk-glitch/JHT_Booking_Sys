import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { AGENCY_RECORD_STATUSES } from "@/features/agency/queries";
import type { AgencyListItem, AgencySignupApplication } from "@/features/agency/types";
import { AgencyCreateForm } from "@/components/admin/MasterDataCreateForms";
import { AgencySignupApplicationActions } from "@/components/admin/AgencyGovernanceActions";
import type { CompanyListItem } from "@/features/company/types";
import { PaginationControls } from "@/components/PaginationControls";
import type { PaginationMeta } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  country?: string;
  status?: string;
  applicationStatus?: string;
  page?: string;
  pageSize?: string;
}>;

type LoadState =
  | { status: "ready"; agencies: AgencyListItem[]; companies: CompanyListItem[]; applications: AgencySignupApplication[]; pagination: PaginationMeta }
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
        <input name="page" type="hidden" value="1" />
        <input name="pageSize" type="hidden" value={filters.pageSize ?? "20"} />
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

      {loadState.status === "ready" ? (
        <SignupApplicationTable applications={loadState.applications} selectedStatus={filters.applicationStatus ?? "pending"} />
      ) : null}

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

      {loadState.status === "ready" ? (
        <>
          <AgencyTable agencies={loadState.agencies} />
          <PaginationControls
            action="/admin/agencies"
            pagination={loadState.pagination}
            searchParams={{
              q: filters.q,
              country: filters.country,
              status: selectedStatus,
              applicationStatus: filters.applicationStatus
            }}
          />
        </>
      ) : null}
    </>
  );
}

function SignupApplicationTable({
  applications,
  selectedStatus
}: {
  applications: AgencySignupApplication[];
  selectedStatus: string;
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Partner Signup Applications</h2>
          <p>Approve applications to create an active agency account and mother ID.</p>
        </div>
        <form className="inline-actions" action="/admin/agencies">
          <select name="applicationStatus" defaultValue={selectedStatus}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="button-secondary" type="submit">
            View
          </button>
        </form>
      </div>
      {applications.length === 0 ? (
        <div className="empty-state compact">
          <p>No signup applications in this status.</p>
        </div>
      ) : (
        <div className="table-shell">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact</th>
                <th>Country</th>
                <th>Currency</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id}>
                  <td>
                    <strong>{application.companyName}</strong>
                    <span className="subtext">{application.website ?? "No website"}</span>
                  </td>
                  <td>
                    {application.contactName ?? "Not set"}
                    <span className="subtext">
                      {application.email} / {application.phone ?? "No phone"}
                    </span>
                  </td>
                  <td>
                    {application.countryCode}
                    {application.countryName ? <span className="subtext">{application.countryName}</span> : null}
                    {application.originalCountryName && application.originalCountryName !== application.countryName ? (
                      <span className="subtext">Input: {application.originalCountryName}</span>
                    ) : null}
                  </td>
                  <td>{application.requestedBillingCurrency ?? "-"}</td>
                  <td>{formatDateTime(application.createdAt)}</td>
                  <td>{formatLabel(application.status)}</td>
                  <td>
                    {application.status === "pending" ? (
                      <AgencySignupApplicationActions application={application} />
                    ) : application.rejectionReason ? (
                      application.rejectionReason
                    ) : (
                      application.createdAgencyAccountId ?? "Reviewed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
            <th>Lifecycle</th>
            <th>Signup / Login</th>
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
              <td>{formatLabel(agency.lifecycleStatus)}</td>
              <td>
                {formatDateTime(agency.createdAt)}
                <span className="subtext">Login: {agency.lastLoginAt ? formatDateTime(agency.lastLoginAt) : "No log"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadAgencies(filters: { q?: string; country?: string; status?: string; applicationStatus?: string; page?: string; pageSize?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads agency customer data through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [agencyResponse, companyResponse, applicationResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/agencies", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/companies", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/agency/signup-applications", { status: filters.applicationStatus ?? "pending" }, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [agencyPayload, companyPayload, applicationPayload] = await Promise.all([
    agencyResponse.json(),
    companyResponse.json(),
    applicationResponse.json()
  ]);

  const failedResponse = [agencyResponse, companyResponse, applicationResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: agencyPayload.error ?? companyPayload.error ?? applicationPayload.error ?? "Unknown agency API error"
    };
  }

  return {
    status: "ready",
    agencies: agencyPayload.data ?? [],
    companies: companyPayload.data ?? [],
    applications: applicationPayload.data ?? [],
    pagination: agencyPayload.pagination
  };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; country?: string; status?: string; page?: string; pageSize?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.country) url.searchParams.set("country", filters.country);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.page) url.searchParams.set("page", filters.page);
  if (filters.pageSize) url.searchParams.set("pageSize", filters.pageSize);
  return url;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value));
}
