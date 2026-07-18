/**
 * @file 한글 책임: Next.js App Router의 `/admin/confirmations` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { demoReservations } from "@/features/reservation/demo-data";
import type { ReservationListItem } from "@/features/reservation/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; reservations: ReservationListItem[]; isPreview: boolean }
  | { status: "error"; message: string };

type SearchParams = Promise<{
  limit?: string;
  from?: string;
  to?: string;
  country?: string;
  agency?: string;
}>;

type ConfirmationFilters = {
  limit: number;
  from: string;
  to: string;
  country: string;
  agency: string;
};

const adminRoute = "/admin" as Route;

/**
 * 확정서 생성 대상 예약을 기간·국가·파트너 조건으로 필터링하고 상태 집계를 함께 제공합니다.
 * 목록과 대시보드는 동일한 필터 결과를 사용해 화면 상단 수치와 실제 행이 어긋나지 않게 합니다.
 */
export default async function AdminConfirmationsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = normalizeFilters(await searchParams);
  const loadState = await loadConfirmationReservations();
  const filteredReservations =
    loadState.status === "ready" ? applyConfirmationFilters(loadState.reservations, filters) : [];
  const visibleReservations = filteredReservations.slice(0, filters.limit);
  const filterOptions =
    loadState.status === "ready" ? buildFilterOptions(loadState.reservations) : { countries: [], agencies: [] };
  const dashboard = buildConfirmationDashboard(filteredReservations);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Final Confirmations</h1>
          <p>Create partner-ready confirmation documents after the final quotation is accepted.</p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      {loadState.status === "ready" && loadState.isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Internal login is bypassed during development, so this page shows accepted reservation samples.</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Confirmations could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <>
          <ConfirmationFilterPanel
            dashboard={dashboard}
            filters={filters}
            options={filterOptions}
            totalCount={filteredReservations.length}
            visibleCount={visibleReservations.length}
          />
          <ConfirmationTable reservations={visibleReservations} />
        </>
      ) : null}
    </>
  );
}

function ConfirmationFilterPanel({
  dashboard,
  filters,
  options,
  totalCount,
  visibleCount
}: {
  dashboard: ReturnType<typeof buildConfirmationDashboard>;
  filters: ConfirmationFilters;
  options: { countries: string[]; agencies: string[] };
  totalCount: number;
  visibleCount: number;
}) {
  return (
    <>
      <form className="confirmation-filter-bar" action="/admin/confirmations">
        <label>
          List
          <select name="limit" defaultValue={String(filters.limit)}>
            <option value="20">20 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Country
          <select name="country" defaultValue={filters.country}>
            <option value="">All countries</option>
            {options.countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agent
          <select name="agency" defaultValue={filters.agency}>
            <option value="">All agents</option>
            {options.agencies.map((agency) => (
              <option key={agency} value={agency}>
                {agency}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Filter</button>
        <Link className="button-secondary" href={"/admin/confirmations" as Route}>
          Reset
        </Link>
      </form>

      <section className="confirmation-kpi-grid" aria-label="Final confirmation status dashboard">
        <article className="confirmation-kpi-tile">
          <span>Visible / Filtered</span>
          <strong>
            {visibleCount} / {totalCount}
          </strong>
        </article>
        <article className="confirmation-kpi-tile">
          <span>Confirmed</span>
          <strong>{dashboard.confirmedCount}</strong>
          <small>{dashboard.confirmedPax.toLocaleString()} pax</small>
        </article>
        <article className="confirmation-kpi-tile">
          <span>Ready to Create</span>
          <strong>{dashboard.readyCount}</strong>
          <small>accepted or confirmed groups</small>
        </article>
        <article className="confirmation-kpi-tile">
          <span>Cancelled</span>
          <strong>{dashboard.cancelledCount}</strong>
          <small>{dashboard.cancelledPax.toLocaleString()} pax</small>
        </article>
        <article className="confirmation-kpi-tile">
          <span>Total Pax</span>
          <strong>{dashboard.totalPax.toLocaleString()}</strong>
        </article>
      </section>

      <section className="confirmation-status-grid" aria-label="Confirmation status by group">
        {dashboard.statusRows.map((row) => (
          <article className="confirmation-status-tile" key={row.status}>
            <div>
              <span className={`status-dot status-${row.status}`}>{formatLabel(row.status)}</span>
              <strong>{row.count} groups</strong>
            </div>
            <p>{row.pax.toLocaleString()} pax</p>
            <meter max="100" value={row.share} />
            <small>{row.share}% of filtered list</small>
          </article>
        ))}
      </section>
    </>
  );
}

function ConfirmationTable({ reservations }: { reservations: ReservationListItem[] }) {
  if (reservations.length === 0) {
    return (
      <section className="empty-state compact">
        <h2>No confirmations match the filters</h2>
        <p>Adjust list count, period, country, or agent filters.</p>
      </section>
    );
  }

  return (
    <section className="confirmation-list" aria-label="Final confirmation list">
      {reservations.map((reservation) => (
        <article className="confirmation-list-row" key={reservation.id}>
          <div className="confirmation-row-status">
            <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
            <span className="confirmation-country-pill">{getReservationCountry(reservation)}</span>
          </div>
          <div className="confirmation-row-main">
            <Link className="strong-link" href={`/admin/confirmations/${reservation.id}` as Route}>
              {reservation.tourName ?? "Tour not set"}
            </Link>
            <span>{reservation.agencyName ?? reservation.agencyAccountId}</span>
          </div>
          <dl className="confirmation-row-meta">
            <div>
              <dt>Reservation</dt>
              <dd>{reservation.reservationCode}</dd>
            </div>
            <div>
              <dt>Dates</dt>
              <dd>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</dd>
            </div>
            <div>
              <dt>Pax</dt>
              <dd>{reservation.estimatedPax ?? "-"} pax</dd>
            </div>
          </dl>
          <div className="confirmation-row-action">
            <Link className="button-secondary" href={`/admin/confirmations/${reservation.id}` as Route}>
              Open Confirmation
            </Link>
          </div>
        </article>
      ))}
    </section>
  );
}

async function loadConfirmationReservations(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return isDemoModeEnabled()
      ? { status: "ready", reservations: demoReservations, isPreview: true }
      : { status: "error", message: "Sign in with an active internal account to view final confirmations." };
  }

  const response = await fetch(buildInternalApiUrl("/api/reservations", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return isDemoModeEnabled()
        ? { status: "ready", reservations: demoReservations, isPreview: true }
        : { status: "error", message: "Your internal session does not have confirmation access." };
    }
    return { status: "error", message: payload.error ?? "Unknown confirmations API error" };
  }

  return { status: "ready", reservations: payload.data ?? [], isPreview: false };
}

function normalizeFilters(searchParams: Awaited<SearchParams>): ConfirmationFilters {
  const parsedLimit = Number(searchParams.limit);
  const limit = [20, 50, 100].includes(parsedLimit) ? parsedLimit : 20;

  return {
    limit,
    from: normalizeDate(searchParams.from),
    to: normalizeDate(searchParams.to),
    country: (searchParams.country ?? "").trim(),
    agency: (searchParams.agency ?? "").trim()
  };
}

function applyConfirmationFilters(reservations: ReservationListItem[], filters: ConfirmationFilters) {
  return reservations.filter((reservation) => {
    if (filters.from && (!reservation.tourEndDate || reservation.tourEndDate < filters.from)) return false;
    if (filters.to && (!reservation.tourStartDate || reservation.tourStartDate > filters.to)) return false;
    if (filters.country && getReservationCountry(reservation) !== filters.country) return false;
    if (filters.agency && (reservation.agencyName ?? reservation.agencyAccountId) !== filters.agency) return false;
    return true;
  });
}

function buildFilterOptions(reservations: ReservationListItem[]) {
  return {
    countries: Array.from(new Set(reservations.map(getReservationCountry))).sort(),
    agencies: Array.from(new Set(reservations.map((reservation) => reservation.agencyName ?? reservation.agencyAccountId))).sort()
  };
}

/** 현재 필터 결과에서 상태별 단체 수·인원·비중을 한 번만 순회해 계산합니다. */
function buildConfirmationDashboard(reservations: ReservationListItem[]) {
  const statusMap = new Map<string, { status: string; count: number; pax: number }>();
  const totalPax = reservations.reduce((sum, reservation) => sum + Number(reservation.estimatedPax ?? 0), 0);

  for (const reservation of reservations) {
    const current = statusMap.get(reservation.status) ?? { status: reservation.status, count: 0, pax: 0 };
    current.count += 1;
    current.pax += Number(reservation.estimatedPax ?? 0);
    statusMap.set(reservation.status, current);
  }

  const statusRows = Array.from(statusMap.values())
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status))
    .map((row) => ({
      ...row,
      share: reservations.length > 0 ? Math.round((row.count / reservations.length) * 100) : 0
    }));

  return {
    totalPax,
    confirmedCount: reservations.filter((reservation) => reservation.status === "confirmed").length,
    confirmedPax: reservations
      .filter((reservation) => reservation.status === "confirmed")
      .reduce((sum, reservation) => sum + Number(reservation.estimatedPax ?? 0), 0),
    readyCount: reservations.filter((reservation) => ["confirmed", "on_tour", "completed"].includes(reservation.status)).length,
    cancelledCount: reservations.filter((reservation) => reservation.status === "cancelled").length,
    cancelledPax: reservations
      .filter((reservation) => reservation.status === "cancelled")
      .reduce((sum, reservation) => sum + Number(reservation.estimatedPax ?? 0), 0),
    statusRows
  };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
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

function normalizeDate(value: string | undefined) {
  if (!value) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function getReservationCountry(reservation: ReservationListItem) {
  const source = `${reservation.agencyName ?? ""} ${reservation.tourName ?? ""} ${reservation.reservationCode}`.toLowerCase();
  if (source.includes("thailand") || source.includes("-th-")) return "Thailand";
  if (source.includes("tokio") || source.includes("japan") || source.includes("-tm-")) return "Japan";
  if (source.includes("worldtravellers") || source.includes("malaysia") || source.includes("-wt-")) return "Malaysia";
  if (source.includes("azza")) return "Egypt";
  return "Not set";
}
