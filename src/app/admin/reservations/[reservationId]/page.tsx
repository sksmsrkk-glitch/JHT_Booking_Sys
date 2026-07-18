/**
 * @file 한글 책임: Next.js App Router의 `/admin/reservations/[reservationId]` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { FinalOperationSnapshotForm } from "@/components/admin/FinalOperationSnapshotForm";
import { InvoiceCreateFromReservationAction } from "@/components/admin/InvoiceCreateFromReservationAction";
import { ReservationActions } from "@/components/admin/ReservationActions";
import { ReservationStatusForm } from "@/components/admin/ReservationStatusForm";
import { RoomAssignmentCreateForm } from "@/components/admin/RoomAssignmentCreateForm";
import { SupplierMessageDraftForm } from "@/components/admin/SupplierMessageDraftForm";
import { getDemoReservationDetail } from "@/features/reservation/demo-data";
import { getReservationDetail } from "@/features/reservation/queries";
import type { ReservationDetail } from "@/features/reservation/types";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { classifyPageDataError, getInternalPageContext } from "@/lib/api/server-page-context";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ reservationId: string }>;

type LoadState =
  | { status: "ready"; reservation: ReservationDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const reservationsRoute = "/admin/reservations" as Route;
const tasksRoute = "/admin/operations/tasks" as Route;
const supplierMessagesRoute = "/admin/supplier-messages" as Route;
const guideExpensesRoute = "/admin/guide-expenses" as Route;

/**
 * 확정 견적에서 파생된 예약, 공급사 실행 기록, 객실 배정 및 최종 일정 스냅샷을 함께 표시합니다.
 * 취소·완료된 예약은 변경 폼을 잠가 과거 운영 기록이 사후 수정되는 것을 화면에서도 방지합니다.
 */
export default async function AdminReservationDetailPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadReservation(reservationId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>Reservation Detail</h1>
            <p>Open a confirmed reservation, update its status, and inspect execution records.</p>
          </div>
          <Link className="button-secondary" href={reservationsRoute}>
            Back to Reservations
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Reservation not found" : "Reservation could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const reservation = loadState.reservation;
  const operationsLockedReason = getOperationsLockedReason(reservation.status);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>{reservation.reservationCode}</h1>
          <p>{reservation.tourName ?? "Tour name not set"}</p>
        </div>
        <Link className="button-secondary" href={reservationsRoute}>
          Back to Reservations
        </Link>
      </div>

      {operationsLockedReason ? (
        <section className="notice warning">
          <h2>Operations are locked</h2>
          <p>{operationsLockedReason}</p>
        </section>
      ) : null}

      <section className="detail-grid">
        <article className="panel">
          <h2>Reservation</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Agency</dt>
              <dd>{reservation.agencyName ?? reservation.agencyAccountId}</dd>
            </div>
            <div>
              <dt>Quote Case</dt>
              <dd>{reservation.caseCode ?? reservation.quoteCaseId}</dd>
            </div>
            <div>
              <dt>Tour Dates</dt>
              <dd>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Status Change</h2>
          <ReservationStatusForm currentStatus={reservation.status} reservationId={reservation.id} />
        </article>
      </section>

      <section className="action-band">
        <div>
          <h2>Operation Setup</h2>
          <p>Generate missing default tasks, then continue task and supplier-message work from internal boards.</p>
        </div>
        <div className="inline-actions">
          <ReservationActions
            disabledReason={operationsLockedReason ?? undefined}
            hasTourStartDate={Boolean(reservation.tourStartDate)}
            reservationId={reservation.id}
          />
          <Link className="button-secondary" href={tasksRoute}>
            Tasks
          </Link>
          <Link className="button-secondary" href={supplierMessagesRoute}>
            Supplier Messages
          </Link>
        </div>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Supplier Message Draft</h2>
            <p>Create a booking, change, confirmation, or cancellation draft directly from this reservation.</p>
          </div>
          <span>{reservation.supplierOptions.length} suppliers</span>
        </div>
        <SupplierMessageDraftForm
          disabledReason={operationsLockedReason ?? undefined}
          reservationContext={{
            code: reservation.reservationCode,
            tourName: reservation.tourName,
            startDate: reservation.tourStartDate,
            endDate: reservation.tourEndDate,
            agencyName: reservation.agencyName
          }}
          reservationId={reservation.id}
          supplierOptions={reservation.supplierOptions}
        />
      </section>

      <section className="action-band">
        <div>
          <h2>Final Operation Confirmation</h2>
          <p>Confirm final hotel, room type, day schedule, meals, flights, and payment snapshot, then issue the invoice automatically.</p>
        </div>
        <span className="status-dot status-live">Quote to Invoice</span>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Final Confirmation Snapshot</h2>
            <p>This snapshot overrides quote itinerary fields when the invoice is generated.</p>
          </div>
          <span>{reservation.acceptedQuoteVersion ? `Quote v${reservation.acceptedQuoteVersion.versionNo}` : "No accepted quote"}</span>
        </div>
        <FinalOperationSnapshotForm
          disabledReason={
            !reservation.acceptedQuoteVersionId
              ? "Accepted quote version is required."
              : operationsLockedReason ?? undefined
          }
          reservationId={reservation.id}
        />
      </section>

      <section className="action-band">
        <div>
          <h2>Finance Fallback</h2>
          <p>Use only when you need to issue from accepted quote total without final operation snapshot details.</p>
        </div>
        <InvoiceCreateFromReservationAction
          canInvoice={Boolean(reservation.acceptedQuoteVersionId) && reservation.status !== "cancelled"}
          reservationId={reservation.id}
        />
      </section>

      <section className="action-band">
        <div>
          <h2>Guide Actual Cost Report</h2>
          <p>After tour completion, collect guide-entered actual expenses and sync submitted rows to finance settlement costs.</p>
        </div>
        <Link className="button-secondary" href={`${guideExpensesRoute}/${reservation.id}` as Route}>
          Open Guide Expenses
        </Link>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Operation Tasks</h2>
          <span>{reservation.operationTasks.length} tasks</span>
        </div>
        {reservation.operationTasks.length > 0 ? (
          <section className="table-shell" aria-label="Reservation operation tasks">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Due</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {reservation.operationTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <strong>{task.title}</strong>
                      <span className="subtext">{formatLabel(task.taskType)}</span>
                    </td>
                    <td>{formatLabel(task.team)}</td>
                    <td>
                      <span className={`status-dot status-${task.status}`}>{formatLabel(task.status)}</span>
                      {task.blockedReason ? <span className="subtext danger-text">{task.blockedReason}</span> : null}
                    </td>
                    <td>{task.dueAt ? formatDateTime(task.dueAt) : "Not set"}</td>
                    <td>{task.domesticSupplierName ?? "Not linked"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No operation tasks</h2>
            <p>Generate default tasks when tour start date is available.</p>
          </section>
        )}
      </section>

      <section className="detail-grid section-block">
        <article className="panel">
          <h2>Status History</h2>
          {reservation.statusHistory.length > 0 ? (
            <ul className="clean-list">
              {reservation.statusHistory.map((history) => (
                <li key={history.id}>
                  {formatLabel(history.fromStatus ?? "none")} to {formatLabel(history.toStatus)}
                  <span className="subtext">
                    {formatDateTime(history.createdAt)}
                    {history.reason ? ` - ${history.reason}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No status history recorded yet.</p>
          )}
        </article>
        <article className="panel">
          <h2>Rooming Lists</h2>
          {reservation.roomingLists.length > 0 ? (
            <ul className="clean-list">
              {reservation.roomingLists.map((roomingList) => (
                <li key={roomingList.id}>
                  rev {roomingList.revisionNo}: {roomingList.originalFilename ?? "Uploaded file"}
                  <span className="subtext">{formatLabel(roomingList.parsedStatus)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No rooming list uploaded.</p>
          )}
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Passengers</h2>
          <span>{reservation.passengers.length} passengers</span>
        </div>
        {reservation.passengers.length > 0 ? (
          <section className="table-shell" aria-label="Reservation passengers">
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>DOB</th>
                  <th>Passport</th>
                  <th>Dietary</th>
                  <th>Coach</th>
                </tr>
              </thead>
              <tbody>
                {reservation.passengers.map((passenger) => (
                  <tr key={passenger.id}>
                    <td>{passenger.passengerNo ?? "n/a"}</td>
                    <td>{passenger.fullName}</td>
                    <td>{passenger.gender ?? "Not set"}</td>
                    <td>{passenger.dateOfBirth ?? "Not set"}</td>
                    <td>{passenger.passportNo ?? "Not set"}</td>
                    <td>{passenger.dietaryRequirements ?? "None"}</td>
                    <td>{passenger.coachLabel ?? "Not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No passengers</h2>
            <p>Passenger rows appear here after an agency rooming list upload.</p>
          </section>
        )}
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Room Assignments</h2>
            <p>Group reservation passengers into rooms for internal hotel and operation work.</p>
          </div>
          <span>{reservation.roomAssignments.length} rooms</span>
        </div>
        <RoomAssignmentCreateForm
          disabledReason={operationsLockedReason ?? undefined}
          passengers={reservation.passengers}
          reservationId={reservation.id}
          roomingLists={reservation.roomingLists}
        />
        {reservation.roomAssignments.length > 0 ? (
          <section className="table-shell nested" aria-label="Reservation room assignments">
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Passengers</th>
                  <th>Dates</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {reservation.roomAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.roomNo ?? "Not set"}</td>
                    <td>{assignment.roomType}</td>
                    <td>
                      {assignment.passengerNames.length > 0 ? assignment.passengerNames.join(", ") : "No passengers"}
                    </td>
                    <td>{formatDateRange(assignment.checkIn, assignment.checkOut)}</td>
                    <td>{assignment.notes ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No room assignments</h2>
            <p>Create room assignments after passengers are available.</p>
          </section>
        )}
      </section>
    </>
  );
}

async function loadReservation(reservationId: string): Promise<LoadState> {
  const demoReservation = getDemoReservationDetail(reservationId);
  try {
    const { supabase } = await getInternalPageContext();
    const reservation = await getReservationDetail(supabase, reservationId);
    if (reservation) return { status: "ready", reservation };
    if (isDemoModeEnabled() && demoReservation) {
      return { status: "ready", reservation: demoReservation };
    }
    return { status: "not-found", message: "Reservation not found" };
  } catch (error) {
    if (isDemoModeEnabled() && demoReservation) return { status: "ready", reservation: demoReservation };
    return classifyPageDataError(error);
  }
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function getOperationsLockedReason(status: string) {
  if (status === "cancelled") return "This reservation is cancelled, so operation tasks, supplier drafts, and room assignments are locked.";
  if (status === "completed") return "This reservation is completed, so operation tasks, supplier drafts, and room assignments are locked.";
  return null;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
