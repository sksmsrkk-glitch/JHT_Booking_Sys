import type { Route } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { RouteCardGrid } from "@/components/v1/RouteCardGrid";
import type { AgencyListItem } from "@/features/agency/types";
import type { InvoiceListItem, SettlementListItem } from "@/features/finance/types";
import type { QuoteCaseListItem } from "@/features/quotation/types";
import type { ReservationListItem } from "@/features/reservation/types";
import { adminRoutes } from "@/features/v1/site-map";
import { getPageAuthorization } from "@/lib/api/page-session";
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
      agencies: AgencyListItem[];
      quoteCases: QuoteCaseListItem[];
      reservations: ReservationListItem[];
      invoices: InvoiceListItem[];
      settlements: SettlementListItem[];
    }
  | {
      status: "auth-required";
      message: string;
      agencies: AgencyListItem[];
      quoteCases: [];
      reservations: [];
      invoices: [];
      settlements: [];
    }
  | { status: "error"; message: string; agencies: AgencyListItem[]; quoteCases: []; reservations: []; invoices: []; settlements: [] };

type DashboardMetric = {
  quoteInquiryCount: number;
  confirmedCount: number;
  cancelledCount: number;
  totalInquiryCount: number;
  quoteCaseCount: number;
  activeReservationCount: number;
  paxCount: number;
  settlementDoneCount: number;
  receivableCount: number;
  receivableAmount: number;
};

type DashboardRow = {
  key: string;
  label: string;
  quoteInquiries: number;
  confirmed: number;
  cancelled: number;
  inquiries: number;
  quoteCases: number;
  pax: number;
  settlementDone: number;
  receivableCount: number;
  receivableAmount: number;
};

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
  const loadState = await loadDashboardData();
  const data = applyDashboardFilters(loadState, filters);

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
          <h1>{locale === "ko" ? "내부 관리자" : "Internal Admin"}</h1>
          <p>
            {locale === "ko"
              ? "파트너 문의, 견적 상태, 예약 확정, 취소, 미수금, 정산 상태를 한눈에 확인합니다."
              : "Partner inquiries, quote status, reservation confirmations, cancellations, receivables, settlements, and follow-up workload at a glance."}
          </p>
        </div>
      </div>

      <AdminDashboard filters={filters} loadState={loadState} data={data} />

      <section className="action-band">
        <div>
          <h2>{locale === "ko" ? "핵심 업무 흐름" : "Main Workflow"}</h2>
          <p>
            {locale === "ko"
              ? "문의에서 견적, 견적에서 예약, 예약에서 공급사 운영, 인보이스와 정산까지 이어집니다."
              : "Request to quote, quote to reservation, reservation to supplier operations, invoice, and settlement."}
          </p>
        </div>
        <span className="status-dot status-live">{locale === "ko" ? "운영중" : "Live"}</span>
      </section>
      <RouteCardGrid locale={locale} routes={primaryRoutes} />
      <section className="section-block">
        <div className="section-heading">
          <h2>{locale === "ko" ? "지원 도구" : "Support Tools"}</h2>
          <span>{locale === "ko" ? `${secondaryRoutes.length}개 도구` : `${secondaryRoutes.length} tools`}</span>
        </div>
        <RouteCardGrid density="compact" locale={locale} routes={secondaryRoutes} />
      </section>
    </>
  );
}

function AdminDashboard({
  filters,
  loadState,
  data
}: {
  filters: DashboardFilters;
  loadState: DashboardLoadState;
  data: ReturnType<typeof applyDashboardFilters>;
}) {
  const metric = buildDashboardMetric(data.agencies, data.quoteCases, data.reservations, data.invoices, data.settlements);
  const countryRows = buildRowsByAgencyDimension(data.agencies, data.quoteCases, data.reservations, data.invoices, data.settlements, "country");
  const partnerRows = buildRowsByAgencyDimension(data.agencies, data.quoteCases, data.reservations, data.invoices, data.settlements, "partner");
  const periodRows = buildRowsByPeriod(data.agencies, data.quoteCases, data.reservations, data.invoices, data.settlements);
  const statusRows = buildRowsByStatus(data.quoteCases, data.reservations, data.invoices, data.settlements);
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

      <DashboardFilterBar agencies={loadState.agencies} filters={filters} />

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
          href={buildMetricHref("/agency/inquiries", filters)}
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

function DashboardFilterBar({ agencies, filters }: { agencies: AgencyListItem[]; filters: DashboardFilters }) {
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

async function loadDashboardData(): Promise<DashboardLoadState> {
  const { authorization, headerStore } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This dashboard reads internal quote, reservation, and agency data and requires a Supabase user JWT with an internal role.",
      agencies: [],
      quoteCases: [],
      reservations: [],
      invoices: [],
      settlements: []
    };
  }

  const [agencyResponse, quoteResponse, reservationResponse, invoiceResponse, settlementResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/agencies", { status: "active" }, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/quote-cases", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/reservations", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/finance/invoices", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/finance/settlements", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);

  const [agencyPayload, quotePayload, reservationPayload, invoicePayload, settlementPayload] = await Promise.all([
    agencyResponse.json(),
    quoteResponse.json(),
    reservationResponse.json(),
    invoiceResponse.json(),
    settlementResponse.json()
  ]);
  const failedResponse = [agencyResponse, quoteResponse, reservationResponse, invoiceResponse, settlementResponse].find((response) => !response.ok);

  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message:
        agencyPayload.error ??
        quotePayload.error ??
        reservationPayload.error ??
        invoicePayload.error ??
        settlementPayload.error ??
        "Unknown dashboard API error",
      agencies: [],
      quoteCases: [],
      reservations: [],
      invoices: [],
      settlements: []
    };
  }

  return {
    status: "ready",
    agencies: agencyPayload.data ?? [],
    quoteCases: quotePayload.data ?? [],
    reservations: reservationPayload.data ?? [],
    invoices: invoicePayload.data ?? [],
    settlements: settlementPayload.data ?? []
  };
}

function applyDashboardFilters(loadState: DashboardLoadState, filters: DashboardFilters) {
  const agencyById = new Map(loadState.agencies.map((agency) => [agency.id, agency]));
  const agencies = loadState.agencies.filter((agency) => matchesAgencyFilter(agency, filters));
  const allowedAgencyIds = new Set(agencies.map((agency) => agency.id));
  const quoteCases = loadState.quoteCases.filter(
    (quoteCase) =>
      allowedAgencyIds.has(quoteCase.agencyAccountId) &&
      matchesDateFilter(resolveQuoteDate(quoteCase), filters)
  );
  const reservations = loadState.reservations.filter(
    (reservation) =>
      allowedAgencyIds.has(reservation.agencyAccountId) &&
      matchesDateFilter(resolveReservationDate(reservation), filters)
  );
  const allowedReservationIds = new Set(reservations.map((reservation) => reservation.id));
  const invoices = loadState.invoices.filter((invoice) => allowedReservationIds.has(invoice.reservationId));
  const settlements = loadState.settlements.filter((settlement) => allowedReservationIds.has(settlement.reservationId));
  const usedAgencyIds = new Set([
    ...quoteCases.map((quoteCase) => quoteCase.agencyAccountId),
    ...reservations.map((reservation) => reservation.agencyAccountId)
  ]);

  return {
    agencies: agencies.filter((agency) => usedAgencyIds.has(agency.id) || !filters.from),
    quoteCases,
    reservations,
    invoices,
    settlements,
    agencyById
  };
}

function buildDashboardMetric(
  agencies: AgencyListItem[],
  quoteCases: QuoteCaseListItem[],
  reservations: ReservationListItem[],
  invoices: InvoiceListItem[],
  settlements: SettlementListItem[]
): DashboardMetric {
  const quoteInquiryCount = quoteCases.filter((quoteCase) =>
    ["new", "triage", "quoting", "sent", "revision_requested"].includes(quoteCase.status)
  ).length;
  const confirmedCount = reservations.filter((reservation) =>
    ["confirmed", "on_tour", "completed"].includes(reservation.status)
  ).length;
  const cancelledCount =
    reservations.filter((reservation) => reservation.status === "cancelled").length +
    quoteCases.filter((quoteCase) => quoteCase.status === "cancelled").length;
  const totalInquiryCount = agencies.reduce((sum, agency) => sum + agency.inquiryCount, 0);
  const quotePax = quoteCases.reduce((sum, quoteCase) => sum + (quoteCase.estimatedPax ?? 0), 0);
  const reservationPax = reservations.reduce((sum, reservation) => sum + resolveReservationPax(reservation), 0);
  const openReceivables = invoices.filter((invoice) => getInvoiceReceivableAmount(invoice) > 0 && invoice.status !== "void");

  return {
    quoteInquiryCount,
    confirmedCount,
    cancelledCount,
    totalInquiryCount,
    quoteCaseCount: quoteCases.length,
    activeReservationCount: reservations.filter((reservation) => !["cancelled", "completed"].includes(reservation.status)).length,
    paxCount: quotePax + reservationPax,
    settlementDoneCount: settlements.filter((settlement) => ["approved", "closed"].includes(settlement.status)).length,
    receivableCount: openReceivables.length,
    receivableAmount: openReceivables.reduce((sum, invoice) => sum + getInvoiceReceivableAmount(invoice), 0)
  };
}

function buildRowsByAgencyDimension(
  agencies: AgencyListItem[],
  quoteCases: QuoteCaseListItem[],
  reservations: ReservationListItem[],
  invoices: InvoiceListItem[],
  settlements: SettlementListItem[],
  dimension: "country" | "partner"
) {
  const agencyById = new Map(agencies.map((agency) => [agency.id, agency]));
  const reservationById = new Map(reservations.map((reservation) => [reservation.id, reservation]));
  const rows = new Map<string, DashboardRow>();

  for (const agency of agencies) {
    const key = dimension === "country" ? agency.countryCode ?? "UNKNOWN" : agency.id;
    ensureRow(rows, key, dimension === "country" ? agency.countryCode ?? "Unknown country" : agency.name).inquiries += agency.inquiryCount;
  }

  for (const quoteCase of quoteCases) {
    const agency = agencyById.get(quoteCase.agencyAccountId);
    const key = dimension === "country" ? agency?.countryCode ?? "UNKNOWN" : quoteCase.agencyAccountId;
    const row = ensureRow(rows, key, dimension === "country" ? agency?.countryCode ?? "Unknown country" : agency?.name ?? quoteCase.agencyName ?? "Unknown partner");
    row.quoteCases += 1;
    row.pax += quoteCase.estimatedPax ?? 0;
    if (["new", "triage", "quoting", "sent", "revision_requested"].includes(quoteCase.status)) row.quoteInquiries += 1;
    if (quoteCase.status === "accepted") row.confirmed += 1;
    if (quoteCase.status === "cancelled") row.cancelled += 1;
  }

  for (const reservation of reservations) {
    const agency = agencyById.get(reservation.agencyAccountId);
    const key = dimension === "country" ? agency?.countryCode ?? "UNKNOWN" : reservation.agencyAccountId;
    const row = ensureRow(rows, key, dimension === "country" ? agency?.countryCode ?? "Unknown country" : agency?.name ?? reservation.agencyName ?? "Unknown partner");
    row.pax += resolveReservationPax(reservation);
    if (["confirmed", "on_tour", "completed"].includes(reservation.status)) row.confirmed += 1;
    if (reservation.status === "cancelled") row.cancelled += 1;
  }

  for (const invoice of invoices) {
    const reservation = reservationById.get(invoice.reservationId);
    const agency = reservation ? agencyById.get(reservation.agencyAccountId) : null;
    const key = dimension === "country" ? agency?.countryCode ?? "UNKNOWN" : reservation?.agencyAccountId ?? invoice.reservationId;
    const row = ensureRow(rows, key, dimension === "country" ? agency?.countryCode ?? "Unknown country" : agency?.name ?? invoice.agencyName ?? "Unknown partner");
    const receivable = getInvoiceReceivableAmount(invoice);
    if (receivable > 0 && invoice.status !== "void") {
      row.receivableCount += 1;
      row.receivableAmount += receivable;
    }
  }

  for (const settlement of settlements) {
    if (!["approved", "closed"].includes(settlement.status)) continue;
    const reservation = reservationById.get(settlement.reservationId);
    const agency = reservation ? agencyById.get(reservation.agencyAccountId) : null;
    const key = dimension === "country" ? agency?.countryCode ?? "UNKNOWN" : reservation?.agencyAccountId ?? settlement.reservationId;
    const row = ensureRow(rows, key, dimension === "country" ? agency?.countryCode ?? "Unknown country" : agency?.name ?? settlement.agencyName ?? "Unknown partner");
    row.settlementDone += 1;
  }

  return sortDashboardRows([...rows.values()]);
}

function buildRowsByPeriod(
  agencies: AgencyListItem[],
  quoteCases: QuoteCaseListItem[],
  reservations: ReservationListItem[],
  invoices: InvoiceListItem[],
  settlements: SettlementListItem[]
) {
  const rows = new Map<string, DashboardRow>();
  const reservationById = new Map(reservations.map((reservation) => [reservation.id, reservation]));
  for (const quoteCase of quoteCases) {
    const key = resolveMonthKey(resolveQuoteDate(quoteCase));
    const row = ensureRow(rows, key, key);
    row.quoteCases += 1;
    row.pax += quoteCase.estimatedPax ?? 0;
    if (["new", "triage", "quoting", "sent", "revision_requested"].includes(quoteCase.status)) row.quoteInquiries += 1;
    if (quoteCase.status === "accepted") row.confirmed += 1;
    if (quoteCase.status === "cancelled") row.cancelled += 1;
  }
  for (const reservation of reservations) {
    const key = resolveMonthKey(resolveReservationDate(reservation));
    const row = ensureRow(rows, key, key);
    row.pax += resolveReservationPax(reservation);
    if (["confirmed", "on_tour", "completed"].includes(reservation.status)) row.confirmed += 1;
    if (reservation.status === "cancelled") row.cancelled += 1;
  }
  for (const agency of agencies) {
    const key = resolveMonthKey(agency.updatedAt);
    ensureRow(rows, key, key).inquiries += agency.inquiryCount;
  }
  for (const invoice of invoices) {
    const reservation = reservationById.get(invoice.reservationId);
    const key = resolveMonthKey(resolveReservationDate(reservation) ?? invoice.createdAt);
    const row = ensureRow(rows, key, key);
    const receivable = getInvoiceReceivableAmount(invoice);
    if (receivable > 0 && invoice.status !== "void") {
      row.receivableCount += 1;
      row.receivableAmount += receivable;
    }
  }
  for (const settlement of settlements) {
    if (!["approved", "closed"].includes(settlement.status)) continue;
    const reservation = reservationById.get(settlement.reservationId);
    const key = resolveMonthKey(resolveReservationDate(reservation) ?? settlement.createdAt);
    ensureRow(rows, key, key).settlementDone += 1;
  }
  return [...rows.values()].sort((left, right) => right.key.localeCompare(left.key));
}

function buildRowsByStatus(
  quoteCases: QuoteCaseListItem[],
  reservations: ReservationListItem[],
  invoices: InvoiceListItem[],
  settlements: SettlementListItem[]
) {
  const rows = new Map<string, DashboardRow>();
  for (const quoteCase of quoteCases) {
    const row = ensureRow(rows, `quote:${quoteCase.status}`, `Quote: ${formatLabel(quoteCase.status)}`);
    row.quoteCases += 1;
    row.pax += quoteCase.estimatedPax ?? 0;
    if (["new", "triage", "quoting", "sent", "revision_requested"].includes(quoteCase.status)) row.quoteInquiries += 1;
    if (quoteCase.status === "accepted") row.confirmed += 1;
    if (quoteCase.status === "cancelled") row.cancelled += 1;
  }
  for (const reservation of reservations) {
    const row = ensureRow(rows, `reservation:${reservation.status}`, `Reservation: ${formatLabel(reservation.status)}`);
    row.pax += resolveReservationPax(reservation);
    if (["confirmed", "on_tour", "completed"].includes(reservation.status)) row.confirmed += 1;
    if (reservation.status === "cancelled") row.cancelled += 1;
  }
  for (const invoice of invoices) {
    const row = ensureRow(rows, `invoice:${invoice.status}`, `Invoice: ${formatLabel(invoice.status)}`);
    const receivable = getInvoiceReceivableAmount(invoice);
    if (receivable > 0 && invoice.status !== "void") {
      row.receivableCount += 1;
      row.receivableAmount += receivable;
    }
  }
  for (const settlement of settlements) {
    const row = ensureRow(rows, `settlement:${settlement.status}`, `Settlement: ${formatLabel(settlement.status)}`);
    if (["approved", "closed"].includes(settlement.status)) row.settlementDone += 1;
  }
  return sortDashboardRows([...rows.values()]);
}

function ensureRow(rows: Map<string, DashboardRow>, key: string, label: string) {
  const existing = rows.get(key);
  if (existing) return existing;
  const row = {
    key,
    label,
    quoteInquiries: 0,
    confirmed: 0,
    cancelled: 0,
    inquiries: 0,
    quoteCases: 0,
    pax: 0,
    settlementDone: 0,
    receivableCount: 0,
    receivableAmount: 0
  };
  rows.set(key, row);
  return row;
}

function sortDashboardRows(rows: DashboardRow[]) {
  return rows.sort(
    (left, right) =>
      right.quoteInquiries +
      right.confirmed +
      right.cancelled +
      right.inquiries +
      right.settlementDone +
      right.receivableCount -
      (left.quoteInquiries + left.confirmed + left.cancelled + left.inquiries + left.settlementDone + left.receivableCount)
  );
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

function matchesAgencyFilter(agency: AgencyListItem, filters: DashboardFilters) {
  if (filters.country && agency.countryCode !== filters.country) return false;
  if (filters.agencyAccountId && agency.id !== filters.agencyAccountId) return false;
  return true;
}

function matchesDateFilter(date: string | null, filters: DashboardFilters) {
  if (!date) return !filters.from && !filters.to;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  return true;
}

function resolveQuoteDate(quoteCase: QuoteCaseListItem) {
  return quoteCase.startDate ?? quoteCase.createdAt ?? null;
}

function resolveReservationDate(reservation: ReservationListItem | undefined) {
  return reservation?.tourStartDate ?? reservation?.createdAt ?? null;
}

function resolveMonthKey(date: string | null) {
  return date ? date.slice(0, 7) : "Unscheduled";
}

function resolveReservationPax(reservation: ReservationListItem) {
  return reservation.estimatedPax ?? 0;
}

function getInvoiceReceivableAmount(invoice: InvoiceListItem) {
  return Math.max(0, Number(invoice.totalAmount ?? 0) - Number(invoice.confirmedPaymentTotal ?? 0));
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

function buildInternalApiUrl(path: string, filters: Record<string, string>, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  for (const [key, value] of Object.entries(filters)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

function normalizeOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: string | undefined) {
  const trimmed = normalizeOptional(value);
  return trimmed && /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

