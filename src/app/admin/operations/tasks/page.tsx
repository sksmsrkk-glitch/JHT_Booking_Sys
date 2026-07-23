/**
 * @file 한글 책임: Next.js App Router의 `/admin/operations/tasks` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { getInternalPageContext } from "@/lib/api/server-page-context";
import { OPERATION_TASK_STATUSES, OPERATION_TEAMS, listRecentNotifications } from "@/features/operations/queries";
import type { NotificationListItem, OperationTaskListItem } from "@/features/operations/types";
import { NotificationInbox } from "@/components/admin/NotificationInbox";
import { OperationTaskActions, type OperationTaskSupplierOption } from "@/components/admin/OperationTaskActions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  team?: string;
  status?: string;
}>;

type LoadState =
  | { status: "ready"; tasks: OperationTaskListItem[]; suppliers: OperationTaskSupplierOption[]; notifications: NotificationListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;
const reservationsRoute = "/admin/reservations" as Route;

export default async function AdminOperationTasksPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadTasks(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Operation Tasks</h1>
          <p>
            Team board for sales, operations, hotel, vehicle, guide, content, and finance
            execution after reservation confirmation.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/operations/tasks">
        <label>
          Search
          <input type="search" name="q" defaultValue={filters.q ?? ""} placeholder="Task title or type" />
        </label>
        <label>
          Team
          <select name="team" defaultValue={filters.team ?? ""}>
            <option value="">All teams</option>
            {OPERATION_TEAMS.map((team) => (
              <option key={team} value={team}>
                {formatLabel(team)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {OPERATION_TASK_STATUSES.map((status) => (
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
          <h2>Reservation Source</h2>
          <p>
            Default tasks are generated from reservations. Status changes use `PATCH
            /api/operation-tasks/:id`; manual reminders use `POST /api/operation-tasks/:id/remind`.
          </p>
        </div>
        <Link className="button-primary" href={reservationsRoute}>
          Open Reservations
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
          <h2>Operation tasks could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <NotificationInbox notifications={loadState.notifications} /> : null}

      {loadState.status === "ready" ? <TaskBoard suppliers={loadState.suppliers} tasks={loadState.tasks} /> : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Operation tasks are internal-only and are not visible in the Agency Portal.</li>
          <li>Done and cancelled tasks are excluded from automated and manual reminders.</li>
          <li>Reminder logs must use idempotency keys to prevent duplicate alerts.</li>
        </ul>
      </section>
    </>
  );
}

function TaskBoard({ tasks, suppliers }: { tasks: OperationTaskListItem[]; suppliers: OperationTaskSupplierOption[] }) {
  if (tasks.length === 0) {
    return (
      <section className="empty-state">
        <h2>No operation tasks found</h2>
        <p>Generate default tasks from a reservation after tour dates are available.</p>
      </section>
    );
  }

  const overdueCount = tasks.filter((task) => isOverdue(task)).length;

  return (
    <>
      <section className="metric-row">
        <article className="metric-card">
          <span>Total Tasks</span>
          <strong>{tasks.length}</strong>
        </article>
        <article className="metric-card">
          <span>Overdue</span>
          <strong>{overdueCount}</strong>
        </article>
        <article className="metric-card">
          <span>Blocked</span>
          <strong>{tasks.filter((task) => task.status === "blocked").length}</strong>
        </article>
      </section>
      <section className="table-shell" aria-label="Operation task board">
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Reservation</th>
              <th>Team</th>
              <th>Status</th>
              <th>Due</th>
              <th>Supplier</th>
              <th>Reminders</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td>
                  <strong>{task.title}</strong>
                  <span className="subtext">{formatLabel(task.taskType)}</span>
                  {task.blockedReason ? <span className="subtext">Blocked: {task.blockedReason}</span> : null}
                </td>
                <td>
                  {task.reservationCode ?? task.reservationId}
                  {task.tourName ? <span className="subtext">{task.tourName}</span> : null}
                  {task.agencyName ? <span className="subtext">{task.agencyName}</span> : null}
                </td>
                <td>{formatLabel(task.team)}</td>
                <td>
                  <span className={`status-dot status-${task.status}`}>{formatLabel(task.status)}</span>
                </td>
                <td>
                  {task.dueAt ? formatDateTime(task.dueAt) : "Not set"}
                  {isOverdue(task) ? <span className="subtext danger-text">Overdue</span> : null}
                </td>
                <td>{task.domesticSupplierName ?? "Not linked"}</td>
                <td>{task.reminderCount}</td>
                <td>
                  <OperationTaskActions
                    currentBlockedReason={task.blockedReason}
                    currentDomesticSupplierId={task.domesticSupplierId}
                    currentDueAt={task.dueAt}
                    currentStatus={task.status}
                    supplierOptions={suppliers}
                    taskId={task.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

async function loadTasks(filters: { q?: string; team?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads operation tasks through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [taskResponse, supplierResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/operation-tasks", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/domestic-suppliers", { status: "active" }, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const payload = await taskResponse.json();

  if (!taskResponse.ok) {
    return {
      status: taskResponse.status === 401 || taskResponse.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown operation task API error"
    };
  }

  const supplierPayload = await supplierResponse.json();
  if (!supplierResponse.ok) {
    return {
      status: supplierResponse.status === 401 || supplierResponse.status === 403 ? "auth-required" : "error",
      message: supplierPayload.error ?? "Unknown domestic supplier API error"
    };
  }

  // 운영 리마인더 알림은 자체 API로 왕복하지 않고 같은 인증 컨텍스트에서 직접 조회합니다.
  let notifications: NotificationListItem[] = [];
  try {
    const { supabase } = await getInternalPageContext();
    notifications = await listRecentNotifications(supabase, { limit: 50 });
  } catch {
    // 알림 조회 실패가 태스크 보드 전체를 막지 않도록 빈 목록으로 처리합니다.
    notifications = [];
  }

  return {
    status: "ready",
    tasks: payload.data ?? [],
    suppliers: (supplierPayload.data ?? []).map((supplier: any) => ({
      id: supplier.id,
      nameKo: supplier.nameKo,
      category: supplier.category
    })),
    notifications
  };
}

function buildInternalApiUrl(
  path: string,
  filters: { q?: string; team?: string; status?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.team) url.searchParams.set("team", filters.team);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function isOverdue(task: OperationTaskListItem) {
  if (!task.dueAt || ["done", "cancelled"].includes(task.status)) return false;
  return new Date(task.dueAt).getTime() < Date.now();
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
