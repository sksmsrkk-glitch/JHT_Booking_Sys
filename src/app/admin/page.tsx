import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import {
  emptyAdminDashboardAnalytics,
  getAdminDashboardAnalytics,
  type AdminDashboardAgencyOption,
  type AdminDashboardAnalytics,
  type AdminDashboardRow as DashboardRow
} from "@/features/admin-dashboard/queries";
import { adminRoutes } from "@/features/v1/site-map";
import {
  classifyPageDataError,
  getInternalPageContext,
  requirePageFinanceRole
} from "@/lib/api/server-page-context";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  country?: string;
  agencyAccountId?: string;
  from?: string;
  to?: string;
  view?: string;
}>;

type DashboardFilters = {
  country?: string;
  agencyAccountId?: string;
  from?: string;
  to?: string;
  view: DashboardView;
};

type DashboardView = "overview" | "country" | "partner" | "period" | "status";

type DashboardLoadState =
  | {
      status: "ready";
      analytics: AdminDashboardAnalytics;
    }
  | {
      status: "auth-required";
      message: string;
      analytics: AdminDashboardAnalytics;
    }
  | { status: "error"; message: string; analytics: AdminDashboardAnalytics };

const dashboardViews: Array<{ value: DashboardView; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "country", label: "Country" },
  { value: "partner", label: "Partner" },
  { value: "period", label: "Period" },
  { value: "status", label: "Status" }
];

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);
  const filters = normalizeDashboardFilters(await searchParams);
  const loadState = await loadDashboardData(filters);

  const primaryTitles = ["Quote Cases", "Reservations", "Domestic Suppliers", "Overseas Agencies"];
  const primaryRoutes = primaryTitles
    .map((title) => adminRoutes.find((route) => route.title === title))
    .filter((route): route is (typeof adminRoutes)[number] => Boolean(route));
  const secondaryRoutes = adminRoutes.filter((route) => !primaryRoutes.includes(route));

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">JHT Internal</p>
          <h1>{locale === "ko" ? "운영 관리자" : "Operation Admin"}</h1>
          <p>
            {locale === "ko"
              ? "파트너 문의, 견적 상태, 예약 확정, 취소, 미수금, 정산 상태를 한눈에 확인합니다."
              : "Partner inquiries, quote status, reservation confirmations, cancellations, receivables, settlements, and follow-up workload at a glance."}
          </p>
        </div>
      </div>

      <AdminDashboard filters={filters} loadState={loadState} />

      <Link
        aria-label={locale === "ko" ? "파트너 소통 워크플로우 열기" : "Open partner communication workflow"}
        className="action-band action-band-link"
        href={"/admin/workflows" as Route}
      >
        <div>
          <h2>{locale === "ko" ? "파트너 소통 워크플로우" : "Partner Communication Workflow"}</h2>
          <p>
            {locale === "ko"
              ? "파트너 문의, 재견적 요청, 내부 회신, 운영 메모와 follow-up action item을 하나의 workflow code로 관리합니다."
              : "Partner requests, quote revisions, JHT replies, internal notes, and follow-up action items under one workflow code."}
          </p>
        </div>
        <span className="status-dot status-live">{locale === "ko" ? "운영중" : "Live"}</span>
      </Link>
      <RouteCardGrid locale={locale} routes={primaryRoutes} />
      <details className="section-block support-tools-disclosure">
        <summary>
          <strong>{locale === "ko" ? "지원 도구" : "Support Tools"}</strong>
          <span>{locale === "ko" ? `${secondaryRoutes.length}개 도구` : `${secondaryRoutes.length} tools`}</span>
        </summary>
        <RouteCardGrid density="compact" locale={locale} routes={secondaryRoutes} />
      </details>
    </>
  );
}

function AdminDashboard({
  filters,
  loadState
}: {
  filters: DashboardFilters;
  loadState: DashboardLoadState;
}) {
  const { metrics: metric, countryRows, partnerRows, periodRows, statusRows, agencyOptions } = loadState.analytics;
  const activeRows =
    filters.view === "country"
      ? countryRows
      : filters.view === "partner"
        ? partnerRows
        : filters.view === "period"
          ? periodRows
          : filters.view === "status"
            ? statusRows
            : countryRows.slice(0, 5);

  return (
    <section className="admin-dashboard-shell" aria-label="Internal admin dashboard">
      <div className="section-heading dashboard-title-row">
        <div>
          <h2>Operations Dashboard</h2>
          <p>Filter by country, partner, and period. Switch views like a Notion database.</p>
        </div>
        <Link className="button-secondary" href={"/admin/quote-cases" as Route}>
          Open Quotes
        </Link>
      </div>

      <DashboardFilterBar agencies={agencyOptions} filters={filters} />

      {loadState.status === "auth-required" ? (
        <section className="notice warning compact-notice">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger compact-notice">
          <h2>Dashboard could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      <div className="dashboard-kpi-grid">
        <MetricCard
          label="Partner quote inquiries"
          value={metric.quoteInquiryCount}
          hint="new, revision, product inquiries"
        />
        <MetricCard
          href={buildMetricHref("/admin/reservations", filters, { status: "confirmed" })}
          label="Confirmed groups"
          value={metric.confirmedCount}
          hint="confirmed, on tour, completed"
          tone="good"
        />
        <MetricCard
          href={buildMetricHref("/admin/reservations", filters, { status: "cancelled" })}
          label="Cancelled groups"
          value={metric.cancelledCount}
          hint="cancelled reservations and quote cases"
          tone="danger"
        />
        <MetricCard
          href={buildMetricHref("/admin/agencies", filters)}
          label="All inquiries"
          value={metric.totalInquiryCount}
          hint="agency inquiry count from partner master"
        />
        <MetricCard
          href={buildMetricHref("/admin/quote-cases", filters)}
          label="Quote cases"
          value={metric.quoteCaseCount}
          hint="quote case records in selected scope"
        />
        <MetricCard label="Total pax" value={metric.paxCount || "-"} hint="estimated quote and reservation pax" />
        <MetricCard
          href={buildMetricHref("/admin/finance/settlements", filters, { status: "approved" })}
          label="Settlement done"
          value={metric.settlementDoneCount}
          hint="approved or closed settlement rows"
          tone="good"
        />
        <MetricCard
          href={buildMetricHref("/admin/finance/invoices", filters)}
          label="Receivable groups"
          value={metric.receivableCount}
          hint="issued invoices with unpaid balance"
          tone="danger"
        />
        <MetricCard
          href={buildMetricHref("/admin/finance/invoices", filters)}
          label="Receivable amount"
          value={formatMoney(metric.receivableAmount)}
          hint="invoice total minus confirmed payments"
          tone="danger"
        />
      </div>

      <div className="dashboard-view-tabs" role="list" aria-label="Dashboard views">
        {dashboardViews.map((view) => (
          <Link
            aria-current={filters.view === view.value ? "page" : undefined}
            className={filters.view === view.value ? "active" : ""}
            href={buildDashboardHref(filters, { view: view.value })}
            key={view.value}
            role="listitem"
          >
            {view.label}
          </Link>
        ))}
      </div>

      <div className="dashboard-layout-grid">
        <DashboardTable rows={activeRows} title={resolveViewTitle(filters.view)} />
        <DashboardBoard countryRows={countryRows} partnerRows={partnerRows} statusRows={statusRows} />
      </div>
    </section>
  );
}

function DashboardFilterBar({ agencies, filters }: { agencies: AdminDashboardAgencyOption[]; filters: DashboardFilters }) {
  const countries = [...new Set(agencies.map((agency) => agency.countryCode).filter(Boolean) as string[])].sort();

  return (
    <form className="toolbar dashboard-toolbar" action="/admin">
      <input name="view" type="hidden" value={filters.view} />
      <label>
        Country
        <select name="country" defaultValue={filters.country ?? ""}>
          <option value="">All countries</option>
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </label>
      <label>
        Partner
        <select name="agencyAccountId" defaultValue={filters.agencyAccountId ?? ""}>
          <option value="">All partners</option>
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        From
        <input name="from" type="date" defaultValue={filters.from ?? ""} />
      </label>
      <label>
        To
        <input name="to" type="date" defaultValue={filters.to ?? ""} />
      </label>
      <button className="button-primary" type="submit">
        Filter
      </button>
    </form>
  );
}

function MetricCard({
  href,
  label,
  value,
  hint,
  tone
}: {
  href?: Route;
  label: string;
  value: number | string;
  hint: string;
  tone?: "good" | "danger";
}) {
  const className = `dashboard-kpi-card ${href ? "is-clickable" : ""} ${tone ? `tone-${tone}` : ""}`;
  const content = (
    <>
      <span>{label}</span>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <small>{hint}</small>
    </>
  );

  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}

function DashboardTable({ rows, title }: { rows: DashboardRow[]; title: string }) {
  return (
    <article className="dashboard-data-card">
      <div className="section-heading">
        <h2>{title}</h2>
        <span>{rows.length} rows</span>
      </div>
      {rows.length === 0 ? (
        <p className="subtext">No dashboard data in this filter.</p>
      ) : (
        <div className="dashboard-table-shell">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quote inquiries</th>
                <th>Confirmed</th>
                <th>Cancelled</th>
                <th>All inquiries</th>
                <th>Settlement done</th>
                <th>Receivable</th>
                <th>Pax</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.label}</strong>
                    <span className="subtext">{row.quoteCases} quote cases</span>
                  </td>
                  <td>{row.quoteInquiries}</td>
                  <td>{row.confirmed}</td>
                  <td>{row.cancelled}</td>
                  <td>{row.inquiries}</td>
                  <td>{row.settlementDone}</td>
                  <td>
                    <strong>{row.receivableCount}</strong>
                    <span className="subtext">{formatMoney(row.receivableAmount)}</span>
                  </td>
                  <td>{row.pax || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function DashboardBoard({
  countryRows,
  partnerRows,
  statusRows
}: {
  countryRows: DashboardRow[];
  partnerRows: DashboardRow[];
  statusRows: DashboardRow[];
}) {
  return (
    <article className="dashboard-data-card">
      <div className="section-heading">
        <h2>Dynamic Board</h2>
        <span>Notion-style</span>
      </div>
      <div className="dashboard-board">
        <DashboardBoardColumn title="Top Countries" rows={countryRows.slice(0, 4)} />
        <DashboardBoardColumn title="Top Partners" rows={partnerRows.slice(0, 4)} />
        <DashboardBoardColumn title="By Status" rows={statusRows.slice(0, 5)} />
      </div>
    </article>
  );
}

function DashboardBoardColumn({ rows, title }: { rows: DashboardRow[]; title: string }) {
  return (
    <section>
      <h3>{title}</h3>
      {rows.length === 0 ? <p className="subtext">No items</p> : null}
      {rows.map((row) => (
        <div className="dashboard-board-card" key={row.key}>
          <strong>{row.label}</strong>
          <span>{row.quoteInquiries} quote inquiries</span>
          <span>{row.confirmed} confirmed / {row.cancelled} cancelled</span>
          <span>{row.settlementDone} settled / {formatMoney(row.receivableAmount)} receivable</span>
        </div>
      ))}
    </section>
  );
}

async function loadDashboardData(filters: DashboardFilters): Promise<DashboardLoadState> {
  try {
    const { supabase, user } = await getInternalPageContext();
    requirePageFinanceRole(user.roles);

    // KPI와 모든 분해 행은 PostgreSQL에서 전체 필터 범위를 집계합니다.
    // 운영 목록의 첫 페이지가 대시보드 수치에 섞이지 않도록 경계를 분리합니다.
    const analytics = await getAdminDashboardAnalytics(supabase, filters);
    return { status: "ready", analytics };
  } catch (error) {
    return {
      ...classifyPageDataError(error),
      analytics: emptyAdminDashboardAnalytics()
    };
  }
}

function normalizeDashboardFilters(params: Awaited<SearchParams>): DashboardFilters {
  const view = dashboardViews.some((item) => item.value === params.view) ? (params.view as DashboardView) : "overview";
  return {
    country: normalizeOptional(params.country)?.toUpperCase(),
    agencyAccountId: normalizeOptional(params.agencyAccountId),
    from: normalizeDate(params.from),
    to: normalizeDate(params.to),
    view
  };
}

function formatMoney(value: number) {
  if (!Number.isFinite(value) || value === 0) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function resolveViewTitle(view: DashboardView) {
  if (view === "country") return "Country View";
  if (view === "partner") return "Partner View";
  if (view === "period") return "Period View";
  if (view === "status") return "Status View";
  return "Overview Table";
}

function buildDashboardHref(filters: DashboardFilters, patch: Partial<DashboardFilters>) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.country) params.set("country", next.country);
  if (next.agencyAccountId) params.set("agencyAccountId", next.agencyAccountId);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  params.set("view", next.view);
  return `/admin?${params.toString()}` as Route;
}

function buildMetricHref(
  path: string,
  filters: DashboardFilters,
  extra: Record<string, string> = {}
) {
  const params = new URLSearchParams();
  if (filters.country && path === "/admin/agencies") params.set("country", filters.country);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}` as Route;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: string | undefined) {
  const trimmed = normalizeOptional(value);
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

