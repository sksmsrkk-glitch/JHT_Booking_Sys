import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { RESERVATION_STATUSES } from "@/features/reservation/queries";
import { demoReservations } from "@/features/reservation/demo-data";
import type { ReservationDashboardData, ReservationListItem } from "@/features/reservation/types";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/api/pagination";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  status?: string;
  month?: string;
  year?: string;
  monthNumber?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
}>;

type LoadState =
  | {
      status: "ready";
      reservations: ReservationListItem[];
      calendarReservations: ReservationListItem[];
      dashboard: ReservationDashboardData;
      pagination: PaginationMeta;
      calendarPagination: PaginationMeta;
      month: string;
      isPreview: boolean;
      previewReason?: string;
    }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const tasksRoute = "/admin/operations/tasks" as Route;

export default async function AdminReservationsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = normalizeReservationPageFilters(await searchParams);
  const loadState = await loadReservations(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Reservations</h1>
          <p>
            Group status board rebuilt from JHT's current 단체현황표 workflow: arrival,
            hotel/stay cells, departure, rooming, supplier tasks, and internal notes.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/reservations">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Code, group, agency" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {RESERVATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
          <label>
            Month
            <input name="month" defaultValue={filters.month ?? ""} placeholder="2026-10" type="month" />
          </label>
          <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
          <input name="sortBy" type="hidden" value={filters.sortBy} />
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="action-band">
        <div>
          <h2>Task Generation</h2>
          <p>
            `POST /api/reservations/:id/generate-operation-tasks` creates default team tasks
            idempotently from the reservation tour start date.
          </p>
        </div>
        <Link className="button-primary" href={tasksRoute}>
          Open Tasks
        </Link>
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Reservations could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? (
        <ReservationWorkspace
          filters={filters}
          isPreview={loadState.isPreview}
          month={loadState.month}
          previewReason={loadState.previewReason}
          reservations={loadState.reservations}
          calendarReservations={loadState.calendarReservations}
          dashboard={loadState.dashboard}
          pagination={loadState.pagination}
          calendarPagination={loadState.calendarPagination}
        />
      ) : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Reservation status changes must write reservation_status_history.</li>
          <li>Agency users can see only their own reservation-safe records.</li>
          <li>Operation tasks and supplier message outbox remain internal-only.</li>
        </ul>
      </section>
    </>
  );
}

function ReservationWorkspace({
  filters,
  isPreview,
  month,
  previewReason,
  reservations,
  calendarReservations,
  dashboard,
  pagination,
  calendarPagination
}: {
  filters: { q?: string; status?: string; month?: string; page: number; pageSize: number; sortBy: string };
  isPreview?: boolean;
  month?: string;
  previewReason?: string;
  reservations: ReservationListItem[];
  calendarReservations: ReservationListItem[];
  dashboard: ReservationDashboardData;
  pagination: PaginationMeta;
  calendarPagination: PaginationMeta;
}) {
  if (dashboard.metrics.totalGroups === 0) {
    return (
      <section className="empty-state">
        <h2>No reservations found</h2>
        <p>Accepted quote versions can be converted into reservations from the quote case detail page.</p>
      </section>
    );
  }

  const visibleMonth = resolveVisibleMonth(month, calendarReservations);
  const weeks = buildMonthWeeks(visibleMonth);

  return (
    <>
      {isPreview ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>
            {previewReason ??
              "No live reservation rows were returned, so this page is showing safe dummy group-status data for UI review."}
          </p>
        </section>
      ) : null}
      <ReservationDashboard dashboard={dashboard} />
      <GroupStatusCalendar filters={filters} reservations={calendarReservations} visibleMonth={visibleMonth} weeks={weeks} />
      {calendarPagination.hasNext ? (
        <section className="notice warning">
          <h2>Calendar display limit</h2>
          <p>
            Showing {calendarReservations.length} of {calendarPagination.total} groups in this month. Narrow the search or
            status filter to inspect every group.
          </p>
        </section>
      ) : null}
      {dashboard.metrics.unscheduledGroups > 0 ? (
        <section className="notice warning">
          <h2>Unscheduled Reservations</h2>
          <p>
            {dashboard.metrics.unscheduledGroups} reservations do not have tour dates yet, so they cannot be placed on the
            group status calendar.
          </p>
        </section>
      ) : null}
      <ReservationOperationsTable filters={filters} pagination={pagination} reservations={reservations} />
      <PaginationControls
        action="/admin/reservations"
        pagination={pagination}
        searchParams={{ q: filters.q, status: filters.status, month: filters.month, sortBy: filters.sortBy }}
      />
    </>
  );
}

function ReservationDashboard({ dashboard }: { dashboard: ReservationDashboardData }) {
  return (
    <section className="reservation-dashboard">
      <div className="metric-row">
        <article className="metric-card">
          <span>Active groups</span>
          <strong>{dashboard.metrics.activeGroups}</strong>
        </article>
        <article className="metric-card">
          <span>Total pax</span>
          <strong>{dashboard.metrics.totalPax || "-"}</strong>
        </article>
        <Link className="metric-card metric-card-link danger-metric" href={"/admin/reservations/incomplete" as Route}>
          <span>Incomplete groups</span>
          <strong>{dashboard.metrics.incompleteGroups}</strong>
        </Link>
      </div>

      <div className="reservation-summary-grid">
        <SummaryPanel rows={dashboard.summaries.monthly} title="Monthly" />
        <SummaryPanel rows={dashboard.summaries.weekly} title="Weekly" />
        <SummaryPanel rows={dashboard.summaries.yearly} title="Yearly" />
        <SummaryPanel rows={dashboard.summaries.partner} title="Partner" />
        <SummaryPanel rows={dashboard.summaries.country} title="Country" />
      </div>
    </section>
  );
}

function SummaryPanel({ rows, title }: { rows: SummaryRow[]; title: string }) {
  return (
    <article className="summary-panel">
      <div className="summary-panel-heading">
        <h3>{title}</h3>
        <span>{rows.reduce((sum, row) => sum + row.groups, 0)} groups</span>
      </div>
      {rows.length > 0 ? (
        <div className="summary-rank-list">
          {rows.slice(0, 5).map((row) => (
            <div className="summary-rank-row" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.groups}</strong>
              <em>{row.pax || "-"} pax</em>
            </div>
          ))}
        </div>
      ) : (
        <p>No scheduled data.</p>
      )}
    </article>
  );
}

function GroupStatusCalendar({
  filters,
  reservations,
  visibleMonth,
  weeks
}: {
  filters: { q?: string; status?: string; month?: string; pageSize: number; sortBy: string };
  reservations: ReservationListItem[];
  visibleMonth: Date;
  weeks: CalendarWeek[];
}) {
  const selectedYear = visibleMonth.getFullYear();
  const selectedMonth = visibleMonth.getMonth() + 1;
  const yearOptions = buildCalendarYearOptions(selectedYear, reservations);
  const previousMonth = addMonths(visibleMonth, -1);
  const nextMonth = addMonths(visibleMonth, 1);

  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Group Calendar</h2>
          <p>Google Calendar style monthly view. Each bar shows only partner + group name.</p>
        </div>
        <div className="calendar-month-controls">
          <Link className="button-secondary mini-button" href={buildReservationCalendarHref(filters, previousMonth) as Route}>
            Previous
          </Link>
          <form action="/admin/reservations" className="calendar-month-form">
            {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
            {filters.status ? <input name="status" type="hidden" value={filters.status} /> : null}
            <input name="pageSize" type="hidden" value={String(filters.pageSize)} />
            <input name="sortBy" type="hidden" value={filters.sortBy} />
            <label>
              Year
              <select defaultValue={String(selectedYear)} name="year">
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Month
              <select defaultValue={String(selectedMonth).padStart(2, "0")} name="monthNumber">
                {Array.from({ length: 12 }, (_, index) => {
                  const month = String(index + 1).padStart(2, "0");
                  return (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  );
                })}
              </select>
            </label>
            <button className="button-primary mini-button" type="submit">
              View
            </button>
          </form>
          <Link className="button-secondary mini-button" href={buildReservationCalendarHref(filters, nextMonth) as Route}>
            Next
          </Link>
          <span className="calendar-current-month">{formatCalendarMonth(visibleMonth)}</span>
        </div>
      </div>
      <section className="reservation-month-calendar" aria-label="Monthly reservation calendar">
        <div className="reservation-calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="reservation-calendar-weeks">
          {weeks.map((week) => (
            <div className="reservation-calendar-week" key={week.index}>
              <div className="reservation-calendar-days">
                {week.days.map((day) => (
                  <div className={day.inMonth ? "calendar-day" : "calendar-day muted"} key={day.iso}>
                    <span>{day.dayOfMonth}</span>
                  </div>
                ))}
              </div>
              <div className="reservation-calendar-bars">
                {reservations
                  .filter((reservation) => overlapsWeek(reservation, week))
                  .map((reservation) => {
                    const span = getWeekBarSpan(reservation, week);
                    const readiness = getReservationReadiness(reservation);
                    return (
                      <Link
                        className={`reservation-event-bar ${readiness.complete ? "complete" : "incomplete"}`}
                        href={`/admin/reservations/${reservation.id}/operation-checklist` as Route}
                        key={`${reservation.id}-${week.index}`}
                        style={{ gridColumn: `${span.start} / ${span.end}` }}
                        title={readiness.complete ? "Reservation ready" : `Missing: ${readiness.missing.join(", ")}`}
                      >
                        {formatReservationBarLabel(reservation)}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
        {reservations.length === 0 ? <p className="calendar-empty-note">No reservations overlap this month.</p> : null}
      </section>
    </section>
  );
}

function LegacyGroupStatusCalendar({
  days,
  reservations,
  visibleMonth
}: {
  days: CalendarDay[];
  reservations: ReservationListItem[];
  visibleMonth: Date;
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Monthly Group Status Board</h2>
          <p>
            단체현황표의 날짜축을 기준으로 입국편, 체류일, 출국일, 호텔/차량/가이드 진행상태를 한 줄에서
            확인합니다.
          </p>
        </div>
        <span>
          {visibleMonth.getFullYear()}-{String(visibleMonth.getMonth() + 1).padStart(2, "0")}
        </span>
      </div>
      <section className="table-shell reservation-calendar-shell" aria-label="Monthly group status board">
        <table className="reservation-calendar-table">
          <thead>
            <tr>
              <th className="sticky-col">Reservation</th>
              <th>Agency / Group</th>
              <th>Pax</th>
              {days.map((day) => (
                <th key={day.iso}>
                  <span>{day.dayOfMonth}</span>
                  <small>{day.weekday}</small>
                </th>
              ))}
              <th>Ops</th>
            </tr>
          </thead>
          <tbody>
            {reservations.length > 0 ? (
              reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td className="sticky-col">
                    <Link className="strong-link" href={`/admin/reservations/${reservation.id}` as Route}>
                      {reservation.reservationCode}
                    </Link>
                    <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
                  </td>
                  <td>
                    <strong>{reservation.tourName ?? "Tour name not set"}</strong>
                    <span className="subtext">{reservation.agencyName ?? reservation.agencyAccountId}</span>
                  </td>
                  <td>{formatPax(reservation)}</td>
                  {days.map((day) => {
                    const cell = getCalendarCell(reservation, day.iso);
                    return (
                      <td className={cell.className} key={`${reservation.id}-${day.iso}`} title={cell.title}>
                        {cell.label}
                      </td>
                    );
                  })}
                  <td>
                    <TeamProgress reservation={reservation} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={days.length + 4}>No reservations overlap this month.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}

function ReservationOperationsTable({
  filters,
  pagination,
  reservations
}: {
  filters: { q?: string; status?: string; month?: string; page: number; pageSize: number; sortBy: string };
  pagination: PaginationMeta;
  reservations: ReservationListItem[];
}) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Action Item List</h2>
          <p>Sort and limit the reservation operation follow-up list as confirmed groups grow.</p>
        </div>
        <form action="/admin/reservations" className="list-control-form">
          {filters.q ? <input name="q" type="hidden" value={filters.q} /> : null}
          {filters.status ? <input name="status" type="hidden" value={filters.status} /> : null}
          {filters.month ? <input name="month" type="hidden" value={filters.month} /> : null}
          <label>
            Sort
            <select defaultValue={filters.sortBy} name="sortBy">
              <option value="start_asc">Tour date ascending</option>
              <option value="start_desc">Tour date descending</option>
              <option value="incomplete_first">Incomplete first</option>
              <option value="status">Status</option>
              <option value="created_desc">Recently created</option>
            </select>
          </label>
          <label>
            Show
            <select defaultValue={String(filters.pageSize)} name="pageSize">
              <option value="20">20 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </select>
          </label>
          <input name="page" type="hidden" value="1" />
          <button className="button-primary mini-button" type="submit">
            Apply
          </button>
        </form>
      </div>
      <section className="table-shell" aria-label="Reservation operation list">
        <table>
          <thead>
            <tr>
              <th>Reservation</th>
              <th>Agency / Group</th>
              <th>Pax</th>
              <th>Status</th>
              <th>Tour Dates</th>
              <th>Operation Progress</th>
              <th>Rooming</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td>
                  <Link className="strong-link" href={`/admin/reservations/${reservation.id}` as Route}>
                    {reservation.reservationCode}
                  </Link>
                  <span className="subtext">{reservation.caseCode ?? reservation.quoteCaseId}</span>
                </td>
                <td>
                  <strong>{reservation.tourName ?? "Tour name not set"}</strong>
                  <span className="subtext">{reservation.agencyName ?? reservation.agencyAccountId}</span>
                </td>
                <td>{formatPax(reservation)}</td>
                <td>
                  <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
                </td>
                <td>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</td>
                <td>
                  <TeamProgress reservation={reservation} />
                </td>
                <td>
                  <strong>{reservation.roomingListCount}</strong>
                  <span className="subtext">rooming list revisions</span>
                </td>
                <td>
                  <ReservationActions
                    hasTourStartDate={Boolean(reservation.tourStartDate)}
                    reservationId={reservation.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="subtext list-result-summary">
        Showing {reservations.length} of {pagination.total} groups on page {pagination.page}.
      </p>
    </section>
  );
}

type CalendarDay = {
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
  weekday: string;
};

type CalendarWeek = {
  index: number;
  startIso: string;
  endIso: string;
  days: CalendarDay[];
};

type SummaryRow = {
  label: string;
  groups: number;
  pax: number;
};

const REQUIRED_OPERATION_ACTIONS = [
  {
    key: "hotel_block",
    label: "Hotel block",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "hotel_booking" && /hotel[_-]?block|hotel[_-]?booking|room[_-]?block/i.test(task.taskType)
  },
  {
    key: "hotel_reconfirm",
    label: "Hotel reconfirm / final confirmation",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "hotel_booking" && /reconfirm|final|confirm/i.test(task.taskType)
  },
  {
    key: "vehicle_booking",
    label: "Vehicle booking",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "vehicle_booking" && /vehicle|coach|bus|transport/i.test(task.taskType)
  },
  {
    key: "guide_assignment",
    label: "Guide assignment",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "guide_assignment" && /guide/i.test(task.taskType)
  },
  {
    key: "driver_info",
    label: "Driver information",
    matches: (task: ReservationListItem["operationTaskSummary"][number]) =>
      task.team === "vehicle_booking" && /driver/i.test(task.taskType)
  }
];

function TeamProgress({ reservation }: { reservation: ReservationListItem }) {
  const teams = [
    ["hotel_booking", "Hotel"],
    ["vehicle_booking", "Vehicle"],
    ["guide_assignment", "Guide"],
    ["content_booking", "Content"],
    ["finance", "Finance"]
  ] as const;

  return (
    <div className="team-progress-list">
      {teams.map(([team, label]) => {
        const tasks = reservation.operationTaskSummary.filter((task) => task.team === team);
        const complete = tasks.filter((task) => ["done", "completed"].includes(task.status)).length;
        const status = tasks.length === 0 ? "empty" : complete === tasks.length ? "done" : "open";
        return (
          <span className={`team-progress team-progress-${status}`} key={team}>
            {label} {tasks.length > 0 ? `${complete}/${tasks.length}` : "-"}
          </span>
        );
      })}
    </div>
  );
}

function resolveVisibleMonth(month: string | undefined, reservations: ReservationListItem[]) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthIndex] = month.split("-").map(Number);
    return new Date(year, monthIndex - 1, 1);
  }

  const firstScheduled = reservations.find((reservation) => reservation.tourStartDate || reservation.tourEndDate);
  if (firstScheduled?.tourStartDate || firstScheduled?.tourEndDate) {
    const date = new Date(`${firstScheduled.tourStartDate ?? firstScheduled.tourEndDate}T00:00:00`);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function buildMonthDays(month: Date): CalendarDay[] {
  const days: CalendarDay[] = [];
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, monthIndex, day);
    days.push({
      iso: toIsoDate(date),
      dayOfMonth: day,
      inMonth: true,
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()]
    });
  }
  return days;
}

function buildMonthWeeks(month: Date): CalendarWeek[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const weeks: CalendarWeek[] = [];
  let index = 0;
  while (cursor <= monthEnd || cursor.getDay() !== 0) {
    const days: CalendarDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const current = new Date(cursor);
      days.push({
        iso: toIsoDate(current),
        dayOfMonth: current.getDate(),
        inMonth: current.getMonth() === monthIndex,
        weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][current.getDay()]
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push({
      index,
      startIso: days[0].iso,
      endIso: days[6].iso,
      days
    });
    index += 1;
    if (cursor > monthEnd && cursor.getDay() === 0) break;
  }
  return weeks;
}

function overlapsMonth(reservation: ReservationListItem, month: Date) {
  if (!reservation.tourStartDate && !reservation.tourEndDate) return false;
  const rangeStart = new Date(`${reservation.tourStartDate ?? reservation.tourEndDate}T00:00:00`);
  const rangeEnd = new Date(`${reservation.tourEndDate ?? reservation.tourStartDate}T00:00:00`);
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return rangeStart <= monthEnd && rangeEnd >= monthStart;
}

function getCalendarCell(reservation: ReservationListItem, iso: string) {
  const start = reservation.tourStartDate;
  const end = reservation.tourEndDate ?? reservation.tourStartDate;
  if (!start || !end || iso < start || iso > end) {
    return { className: "calendar-cell-empty", label: "", title: "" };
  }
  if (iso === start && iso === end) {
    return { className: "calendar-cell-active calendar-cell-arrival", label: "DAY", title: reservation.tourName ?? "" };
  }
  if (iso === start) {
    return { className: "calendar-cell-active calendar-cell-arrival", label: "ARR", title: "Arrival / start" };
  }
  if (iso === end) {
    return { className: "calendar-cell-active calendar-cell-departure", label: "DEP", title: "Departure / end" };
  }
  return { className: "calendar-cell-active", label: "STAY", title: "Hotel / tour operation day" };
}

function overlapsWeek(reservation: ReservationListItem, week: CalendarWeek) {
  const start = reservation.tourStartDate ?? reservation.tourEndDate;
  const end = reservation.tourEndDate ?? reservation.tourStartDate;
  if (!start || !end) return false;
  return start <= week.endIso && end >= week.startIso;
}

function getWeekBarSpan(reservation: ReservationListItem, week: CalendarWeek) {
  const start = reservation.tourStartDate ?? reservation.tourEndDate ?? week.startIso;
  const end = reservation.tourEndDate ?? reservation.tourStartDate ?? week.endIso;
  const visibleStart = start < week.startIso ? week.startIso : start;
  const visibleEnd = end > week.endIso ? week.endIso : end;
  const startIndex = week.days.findIndex((day) => day.iso === visibleStart);
  const endIndex = week.days.findIndex((day) => day.iso === visibleEnd);
  return {
    start: Math.max(startIndex, 0) + 1,
    end: Math.max(endIndex, 0) + 2
  };
}

function getReservationReadiness(reservation: ReservationListItem) {
  if (typeof reservation.operationReady === "boolean") {
    return {
      complete: reservation.operationReady,
      missing: reservation.operationMissing ?? []
    };
  }
  const doneTasks = reservation.operationTaskSummary.filter((task) => ["done", "completed"].includes(task.status));
  const missing = REQUIRED_OPERATION_ACTIONS.filter(
    (action) => !doneTasks.some((task) => action.matches(task))
  ).map((action) => action.label);
  return {
    complete: missing.length === 0,
    missing
  };
}

function formatReservationBarLabel(reservation: ReservationListItem) {
  const agency = reservation.agencyName ?? "Unknown partner";
  return `${agency} - ${reservation.tourName ?? reservation.reservationCode}`;
}

function summarizeByMonth(reservations: ReservationListItem[]) {
  return summarizeBy(reservations, (reservation) => {
    const date = reservation.tourStartDate ?? reservation.tourEndDate;
    return date ? date.slice(0, 7) : "Unscheduled";
  });
}

function summarizeByYear(reservations: ReservationListItem[]) {
  return summarizeBy(reservations, (reservation) => {
    const date = reservation.tourStartDate ?? reservation.tourEndDate;
    return date ? date.slice(0, 4) : "Unscheduled";
  });
}

function summarizeByWeek(reservations: ReservationListItem[], visibleMonth: Date) {
  return buildMonthWeeks(visibleMonth).map((week) => {
    const matching = reservations.filter((reservation) => overlapsWeek(reservation, week));
    return {
      label: `${week.startIso.slice(5)} ~ ${week.endIso.slice(5)}`,
      groups: matching.length,
      pax: matching.reduce((sum, reservation) => sum + resolvePaxNumber(reservation), 0)
    };
  });
}

function summarizeByPartner(reservations: ReservationListItem[]) {
  return summarizeBy(reservations, (reservation) => reservation.agencyName ?? "Unknown partner");
}

function summarizeByCountry(reservations: ReservationListItem[]) {
  return summarizeBy(reservations, (reservation) => inferCountryLabel(reservation.tourName ?? ""));
}

function summarizeBy(reservations: ReservationListItem[], getLabel: (reservation: ReservationListItem) => string) {
  const rows = new Map<string, SummaryRow>();
  for (const reservation of reservations) {
    const label = getLabel(reservation);
    const current = rows.get(label) ?? { label, groups: 0, pax: 0 };
    current.groups += 1;
    current.pax += resolvePaxNumber(reservation);
    rows.set(label, current);
  }
  return Array.from(rows.values()).sort((a, b) => b.groups - a.groups || b.pax - a.pax);
}

function sortReservations(reservations: ReservationListItem[], sortBy: string) {
  return [...reservations].sort((a, b) => {
    if (sortBy === "start_desc") return compareDateValues(b.tourStartDate, a.tourStartDate) || compareText(a.reservationCode, b.reservationCode);
    if (sortBy === "incomplete_first") {
      const aIncomplete = getReservationReadiness(a).complete ? 1 : 0;
      const bIncomplete = getReservationReadiness(b).complete ? 1 : 0;
      return aIncomplete - bIncomplete || compareDateValues(a.tourStartDate, b.tourStartDate);
    }
    if (sortBy === "status") return compareText(a.status, b.status) || compareDateValues(a.tourStartDate, b.tourStartDate);
    if (sortBy === "created_desc") return compareDateValues(b.createdAt, a.createdAt) || compareText(a.reservationCode, b.reservationCode);
    return compareDateValues(a.tourStartDate, b.tourStartDate) || compareText(a.reservationCode, b.reservationCode);
  });
}

function compareDateValues(a: string | null, b: string | null) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

function compareText(a: string | null | undefined, b: string | null | undefined) {
  return (a ?? "").localeCompare(b ?? "");
}

function inferCountryLabel(text: string) {
  const normalized = text.toLowerCase();
  const candidates = [
    ["Thailand", ["thai", "thailand"]],
    ["Malaysia", ["malaysia", "malaysian"]],
    ["Indonesia", ["indonesia", "indonesian", "irfan"]],
    ["Philippines", ["philippines", "manila", "cebu"]],
    ["Taiwan", ["taiwan"]],
    ["Hong Kong", ["hongthai", "hong kong"]],
    ["Japan", ["japan", "tokio", "tokyo"]]
  ] as const;
  const match = candidates.find(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  return match ? match[0] : "Unspecified";
}

function formatPax(reservation: ReservationListItem) {
  const pax = resolvePaxNumber(reservation);
  return pax > 0 ? `${pax} pax` : "Not set";
}

function resolvePaxNumber(reservation: ReservationListItem) {
  if (reservation.estimatedPax) return reservation.estimatedPax;
  const text = reservation.tourName ?? "";
  const exactTotal = text.match(/=\s*(\d+)/);
  if (exactTotal) return Number(exactTotal[1]);

  let sum = 0;
  const paxPattern = /(\d+)\s*(a|c|inf|tl)\b/gi;
  for (const match of text.matchAll(paxPattern)) {
    sum += Number(match[1]);
  }
  return sum;
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeReservationPageFilters(filters: {
  q?: string;
  status?: string;
  month?: string;
  year?: string;
  monthNumber?: string;
  page?: string;
  pageSize?: string;
  sortBy?: string;
}) {
  const normalizedMonth =
    filters.year && filters.monthNumber
      ? `${filters.year}-${String(Number(filters.monthNumber)).padStart(2, "0")}`
      : filters.month;
  const pageSize = normalizePageSize(filters.pageSize);
  const sortBy = normalizeReservationSort(filters.sortBy);

  return {
    q: filters.q,
    status: filters.status,
    month: normalizedMonth && /^\d{4}-\d{2}$/.test(normalizedMonth) ? normalizedMonth : currentCalendarMonth(),
    page: normalizePositiveInteger(filters.page, 1),
    pageSize,
    sortBy
  };
}

function normalizePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function currentCalendarMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizePageSize(value: string | undefined) {
  const parsed = Number(value);
  return [20, 50, 100].includes(parsed) ? parsed : 20;
}

function normalizeReservationSort(value: string | undefined) {
  const allowed = ["start_asc", "start_desc", "incomplete_first", "status", "created_desc"];
  return value && allowed.includes(value) ? value : "start_asc";
}

function buildCalendarYearOptions(selectedYear: number, reservations: ReservationListItem[]) {
  const years = new Set<number>([selectedYear - 1, selectedYear, selectedYear + 1]);
  for (const reservation of reservations) {
    const startYear = reservation.tourStartDate ? Number(reservation.tourStartDate.slice(0, 4)) : null;
    const endYear = reservation.tourEndDate ? Number(reservation.tourEndDate.slice(0, 4)) : null;
    if (startYear) years.add(startYear);
    if (endYear) years.add(endYear);
  }
  return Array.from(years.values()).sort((a, b) => a - b);
}

function addMonths(month: Date, amount: number) {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

function buildReservationCalendarHref(filters: { q?: string; status?: string; pageSize?: number; sortBy?: string }, month: Date) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  params.set("month", formatCalendarMonth(month));
  return `/admin/reservations?${params.toString()}`;
}

function formatCalendarMonth(month: Date) {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
}

async function loadReservations(filters: {
  q?: string;
  status?: string;
  month?: string;
  page: number;
  pageSize: number;
  sortBy: string;
}): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    if (isDemoModeEnabled()) {
      return buildDemoReservationState(
        filters,
        "Demo mode is enabled. Showing sample group-status data without an internal session."
      );
    }
    return {
      status: "auth-required",
      message: "Sign in with an active internal account to view reservation operations."
    };
  }

  const [listResponse, dashboardResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/reservations", filters, headerStore, true), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/reservations/dashboard", filters, headerStore, false), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [listPayload, dashboardPayload] = await Promise.all([listResponse.json(), dashboardResponse.json()]);

  if (!listResponse.ok || !dashboardResponse.ok) {
    if ([listResponse.status, dashboardResponse.status].some((status) => status === 401 || status === 403)) {
      if (isDemoModeEnabled()) {
        return buildDemoReservationState(
          filters,
          "Demo mode is enabled because the live reservation API rejected the current session."
        );
      }
      return {
        status: "auth-required",
        message: "Your internal session is missing, expired, or does not have reservation access."
      };
    }
    return {
      status: "error",
      message: listPayload.error ?? dashboardPayload.error ?? "Unknown reservation API error"
    };
  }

  return {
    status: "ready",
    reservations: listPayload.data ?? [],
    calendarReservations: dashboardPayload.data?.calendar ?? [],
    dashboard: dashboardPayload.data,
    pagination: listPayload.pagination,
    calendarPagination: dashboardPayload.data?.calendarPagination,
    month: dashboardPayload.data?.month ?? filters.month,
    isPreview: false
  };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; status?: string; month?: string; page: number; pageSize: number; sortBy: string },
  headerStore: Headers,
  includeListControls: boolean
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.month) url.searchParams.set("month", filters.month);
  if (includeListControls) {
    url.searchParams.set("page", String(filters.page));
    url.searchParams.set("pageSize", String(filters.pageSize));
    url.searchParams.set("sortBy", filters.sortBy);
  }
  return url;
}

function buildDemoReservationState(
  filters: { q?: string; status?: string; month?: string; page: number; pageSize: number; sortBy: string },
  previewReason: string
): LoadState {
  const filtered = filterDemoReservations(filters);
  const visibleMonth = resolveVisibleMonth(filters.month, filtered);
  const calendarReservations = filtered.filter((reservation) => overlapsMonth(reservation, visibleMonth));
  const sorted = sortReservations(filtered, filters.sortBy);
  const from = (filters.page - 1) * filters.pageSize;
  const reservations = sorted.slice(from, from + filters.pageSize);
  return {
    status: "ready",
    reservations,
    calendarReservations,
    dashboard: buildDemoDashboard(filtered, visibleMonth),
    pagination: buildPaginationMeta({ page: filters.page, pageSize: filters.pageSize }, filtered.length, reservations.length),
    calendarPagination: buildPaginationMeta(
      { page: 1, pageSize: 250 },
      calendarReservations.length,
      calendarReservations.length
    ),
    month: formatCalendarMonth(visibleMonth),
    isPreview: true,
    previewReason
  };
}

function buildDemoDashboard(reservations: ReservationListItem[], visibleMonth: Date): ReservationDashboardData {
  return {
    metrics: {
      totalGroups: reservations.length,
      activeGroups: reservations.filter((reservation) => !["completed", "cancelled"].includes(reservation.status)).length,
      totalPax: reservations.reduce((sum, reservation) => sum + resolvePaxNumber(reservation), 0),
      incompleteGroups: reservations.filter((reservation) => !getReservationReadiness(reservation).complete).length,
      unscheduledGroups: reservations.filter((reservation) => !reservation.tourStartDate && !reservation.tourEndDate).length
    },
    summaries: {
      monthly: summarizeByMonth(reservations),
      weekly: summarizeByWeek(reservations, visibleMonth),
      yearly: summarizeByYear(reservations),
      partner: summarizeByPartner(reservations),
      country: summarizeByCountry(reservations)
    }
  };
}

function filterDemoReservations(filters: { q?: string; status?: string }) {
  const q = filters.q?.trim().toLowerCase();
  return demoReservations.filter((reservation) => {
    const statusMatch = !filters.status || reservation.status === filters.status;
    const searchText = [
      reservation.reservationCode,
      reservation.caseCode,
      reservation.agencyName,
      reservation.tourName
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const searchMatch = !q || searchText.includes(q);
    return statusMatch && searchMatch;
  });
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
