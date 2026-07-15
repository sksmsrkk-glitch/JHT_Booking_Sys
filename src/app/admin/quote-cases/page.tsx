import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { QUOTE_STATUSES } from "@/features/quotation/queries";
import type { QuoteCaseListItem } from "@/features/quotation/types";
import { QuoteCaseCreateForm } from "@/components/admin/QuoteCaseCreateForm";
import type { AgencyListItem } from "@/features/agency/types";
import type { CompanyListItem } from "@/features/company/types";
import { PaginationControls } from "@/components/PaginationControls";
import type { PaginationMeta } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}>;

type LoadState =
  | { status: "ready"; quoteCases: QuoteCaseListItem[]; agencies: AgencyListItem[]; companies: CompanyListItem[]; pagination: PaginationMeta }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const costSearchRoute = "/admin/costing/search" as Route;

export default async function AdminQuoteCasesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadQuoteCases(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Quote Cases</h1>
          <p>
            Create quote cases, manage versions, preserve cost snapshots, and separate public
            Agency summaries from internal totals.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/quote-cases">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Case code, tour, share id" />
        </label>
        <input name="page" type="hidden" value="1" />
        <input name="pageSize" type="hidden" value={filters.pageSize ?? "20"} />
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {QUOTE_STATUSES.map((status) => (
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

      <section className="action-band">
        <div>
          <h2>Create Quote Case</h2>
          <p>
            Create a quote case, draft version, itinerary rows, and internal quote item snapshots
            from one controlled form.
          </p>
        </div>
        <Link className="button-primary" href={costSearchRoute}>
          Search Costs
        </Link>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Create Quote Case</h2>
          <span>Internal only</span>
        </div>
        <QuoteCaseCreateForm
          agencies={loadState.status === "ready" ? loadState.agencies : []}
          companies={loadState.status === "ready" ? loadState.companies : []}
        />
        <p className="subtext">
          Quote item rows must include snapshot item name, supplier name, cost currency, unit
          cost, exchange rate, pricing unit, quantity, pax count, and margin mode.
        </p>
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Quote cases could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <QuoteCaseTable quoteCases={loadState.quoteCases} />
          <PaginationControls
            action="/admin/quote-cases"
            pagination={loadState.pagination}
            searchParams={{ q: filters.q, status: filters.status }}
          />
        </>
      ) : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Every quote case must be linked to exactly one Overseas Agency.</li>
          <li>Quote item cost and margin data are internal-only.</li>
          <li>Agency-visible quote versions expose only public totals and public summaries.</li>
        </ul>
      </section>
    </>
  );
}

function QuoteCaseTable({ quoteCases }: { quoteCases: QuoteCaseListItem[] }) {
  if (quoteCases.length === 0) {
    return (
      <section className="empty-state">
        <h2>No quote cases found</h2>
        <p>Create a quote case after selecting an Overseas Agency and cost snapshot items.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Quote cases">
      <table>
        <thead>
          <tr>
            <th>Case</th>
            <th>Agency</th>
            <th>Status</th>
            <th>Dates</th>
            <th>Pax</th>
            <th>Versions</th>
            <th>Latest Public Total</th>
          </tr>
        </thead>
        <tbody>
          {quoteCases.map((quoteCase) => (
            <tr key={quoteCase.id}>
              <td>
                <Link className="strong-link" href={`/admin/quote-cases/${quoteCase.id}` as Route}>
                  {quoteCase.caseCode}
                </Link>
                <span className="subtext">{quoteCase.tourName}</span>
              </td>
              <td>{quoteCase.agencyName ?? quoteCase.agencyAccountId}</td>
              <td>
                <span className={`status-dot status-${quoteCase.status}`}>{formatLabel(quoteCase.status)}</span>
              </td>
              <td>{formatDateRange(quoteCase.startDate, quoteCase.endDate)}</td>
              <td>{quoteCase.estimatedPax ?? "Not set"}</td>
              <td>
                {quoteCase.versionCount}
                {quoteCase.latestVersionStatus ? (
                  <span className="subtext">Latest: {formatLabel(quoteCase.latestVersionStatus)}</span>
                ) : null}
              </td>
              <td>
                {quoteCase.publicTotalAmount === null
                  ? "Not set"
                  : `${quoteCase.currency} ${quoteCase.publicTotalAmount.toLocaleString()}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadQuoteCases(filters: { q?: string; status?: string; page?: string; pageSize?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads quote cases through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [quoteResponse, agencyResponse, companyResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/quote-cases", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/agencies", { status: "active" }, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/companies", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [quotePayload, agencyPayload, companyPayload] = await Promise.all([
    quoteResponse.json(),
    agencyResponse.json(),
    companyResponse.json()
  ]);

  const failedResponse = [quoteResponse, agencyResponse, companyResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: quotePayload.error ?? agencyPayload.error ?? companyPayload.error ?? "Unknown quote case API error"
    };
  }

  return {
    status: "ready",
    quoteCases: quotePayload.data ?? [],
    agencies: agencyPayload.data ?? [],
    companies: companyPayload.data ?? [],
    pagination: quotePayload.pagination
  };
}

function buildInternalApiUrl(path: string, filters: { q?: string; status?: string; page?: string; pageSize?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.page) url.searchParams.set("page", filters.page);
  if (filters.pageSize) url.searchParams.set("pageSize", filters.pageSize);
  return url;
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
