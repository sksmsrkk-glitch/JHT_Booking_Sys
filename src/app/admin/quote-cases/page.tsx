import type { Route } from "next";
import Link from "next/link";
import { QUOTE_STATUSES, listQuoteCasePage } from "@/features/quotation/queries";
import type { QuoteCaseListItem } from "@/features/quotation/types";
import { QuoteCaseCreateForm } from "@/components/admin/QuoteCaseCreateForm";
import type { AgencyListItem } from "@/features/agency/types";
import { listAgencyAccountPage } from "@/features/agency/queries";
import type { CompanyListItem } from "@/features/company/types";
import { listCompanies } from "@/features/company/queries";
import { PaginationControls } from "@/components/PaginationControls";
import { parsePagination, type PaginationMeta } from "@/lib/api/pagination";
import { classifyPageDataError, getInternalPageContext } from "@/lib/api/server-page-context";

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

      <details className="quote-create-disclosure">
        <summary>
          <span>
            <strong>Create Quote Case</strong>
            <small>Open the full costing, itinerary, and quote-item editor only when needed.</small>
          </span>
          <span className="disclosure-action">Open editor</span>
        </summary>
        <div className="quote-create-disclosure-body">
          <div className="section-heading">
            <div>
              <h2>Create Quote Case</h2>
              <p className="subtext">Draft a version with its internal cost snapshots and itinerary rows.</p>
            </div>
            <Link className="button-secondary" href={costSearchRoute}>
              Search Costs
            </Link>
          </div>
          <QuoteCaseCreateForm
            agencies={loadState.status === "ready" ? loadState.agencies : []}
            companies={loadState.status === "ready" ? loadState.companies : []}
          />
          <p className="subtext">
            Quote item rows must include snapshot item name, supplier name, cost currency, unit
            cost, exchange rate, pricing unit, quantity, pax count, and margin mode.
          </p>
        </div>
      </details>

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
  try {
    const { supabase } = await getInternalPageContext();
    const searchParams = new URLSearchParams();
    if (filters.page) searchParams.set("page", filters.page);
    if (filters.pageSize) searchParams.set("pageSize", filters.pageSize);
    const pagination = parsePagination(searchParams);

    /* 인증을 한 번만 확인한 뒤 화면에 필요한 세 조회를 같은 서버 요청에서 병렬 실행합니다. */
    const [quoteCases, agencies, companies] = await Promise.all([
      listQuoteCasePage(supabase, { q: filters.q, status: filters.status }, pagination),
      listAgencyAccountPage(supabase, { status: "active" }, { page: 1, pageSize: 100 }),
      listCompanies(supabase)
    ]);

    return {
      status: "ready",
      quoteCases: quoteCases.items,
      agencies: agencies.items,
      companies,
      pagination: quoteCases.pagination
    };
  } catch (error) {
    return classifyPageDataError(error);
  }
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
