import type { Route } from "next";
import Link from "next/link";
import type {
  ReservationDetail,
  ReservationOperationTaskItem,
  ReservationQuoteItem,
  ReservationSupplierMessageItem
} from "@/features/reservation/types";
import { getDemoReservationDetail } from "@/features/reservation/demo-data";
import { getPageAuthorization } from "@/lib/api/page-session";
import { isDemoModeEnabled } from "@/lib/api/guards";

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

const REQUIRED_ACTIONS = [
  {
    key: "hotel_block",
    label: "Hotel Block",
    owner: "Hotel booking",
    description: "Room block or hotel booking request is completed.",
    matches: (task: ReservationOperationTaskItem) =>
      task.team === "hotel_booking" && /hotel[_-]?block|hotel[_-]?booking|room[_-]?block/i.test(task.taskType),
    matchesQuote: (item: ReservationQuoteItem) =>
      /hotel|room|meeting_room/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`),
    matchesMessage: (message: ReservationSupplierMessageItem) => /booking|confirmation|change|cancellation|final/i.test(message.messageType)
  },
  {
    key: "hotel_reconfirm",
    label: "Hotel Reconfirm / Final",
    owner: "Hotel booking",
    description: "Hotel block has been reconfirmed and finalized.",
    matches: (task: ReservationOperationTaskItem) =>
      task.team === "hotel_booking" && /reconfirm|final|confirm/i.test(task.taskType),
    matchesQuote: (item: ReservationQuoteItem) =>
      /hotel|room|meeting_room/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`),
    matchesMessage: (message: ReservationSupplierMessageItem) => message.messageType === "final_confirmation"
  },
  {
    key: "vehicle_booking",
    label: "Vehicle Booking",
    owner: "Vehicle booking",
    description: "Coach, van, car, or transfer booking is completed.",
    matches: (task: ReservationOperationTaskItem) =>
      task.team === "vehicle_booking" && /vehicle|coach|bus|transport/i.test(task.taskType),
    matchesQuote: (item: ReservationQuoteItem) =>
      /vehicle|transport|coach|bus|van|car/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`),
    matchesMessage: (message: ReservationSupplierMessageItem) => /booking|change|cancellation|final/i.test(message.messageType)
  },
  {
    key: "guide_assignment",
    label: "Guide Assignment",
    owner: "Guide assignment",
    description: "Guide has been assigned to the group.",
    matches: (task: ReservationOperationTaskItem) => task.team === "guide_assignment" && /guide/i.test(task.taskType),
    matchesQuote: (item: ReservationQuoteItem) =>
      /guide/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`),
    matchesMessage: (message: ReservationSupplierMessageItem) => /booking|change|cancellation|final/i.test(message.messageType)
  },
  {
    key: "driver_info",
    label: "Driver Information",
    owner: "Vehicle booking",
    description: "Driver name, phone, and vehicle information are ready.",
    matches: (task: ReservationOperationTaskItem) => task.team === "vehicle_booking" && /driver/i.test(task.taskType),
    matchesQuote: (item: ReservationQuoteItem) =>
      /vehicle|transport|coach|bus|van|car/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`),
    matchesMessage: (message: ReservationSupplierMessageItem) => message.messageType === "final_confirmation"
  }
];

export default async function ReservationOperationChecklistPage({ params }: { params: PageParams }) {
  const { reservationId } = await params;
  const loadState = await loadReservation(reservationId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>Reservation Operation Checklist</h1>
            <p>Confirm missing hotel, vehicle, guide, and driver follow-up items.</p>
          </div>
          <Link className="button-secondary" href={reservationsRoute}>
            Back to Calendar
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Reservation not found" : "Internal role required"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  return <ChecklistContent reservation={loadState.reservation} />;
}

function ChecklistContent({ reservation }: { reservation: ReservationDetail }) {
  const workflowItems = buildWorkflowItems(reservation);
  const complete = workflowItems.every((item) => item.taskComplete && item.finalConfirmed);
  const quotedCategories = summarizeQuoteCategories(reservation.quoteItems);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Reservation Workflow</p>
          <h1>{reservation.agencyName ?? "Partner"} - {reservation.tourName ?? reservation.reservationCode}</h1>
          <p>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</p>
        </div>
        <div className="inline-actions">
          <Link className="button-secondary" href={reservationsRoute}>
            Calendar
          </Link>
          <Link className="button-primary" href={`/admin/reservations/${reservation.id}` as Route}>
            Full Detail
          </Link>
        </div>
      </div>

      <section className="workflow-chain">
        <article>
          <span>1</span>
          <h2>Accepted Quote</h2>
          <p>
            {reservation.acceptedQuoteVersion
              ? `Version ${reservation.acceptedQuoteVersion.versionNo} accepted`
              : "Accepted quote version is not linked"}
          </p>
        </article>
        <article>
          <span>2</span>
          <h2>Reservation</h2>
          <p>{reservation.reservationCode} / {formatLabel(reservation.status)}</p>
        </article>
        <article>
          <span>3</span>
          <h2>Supplier Workflow</h2>
          <p>Booking, change, cancellation, and final confirmation messages.</p>
        </article>
        <article>
          <span>4</span>
          <h2>Dashboard</h2>
          <p>Incomplete items keep the calendar bar red until resolved.</p>
        </article>
      </section>

      <section className={`operation-readiness-banner ${complete ? "complete" : "incomplete"}`}>
        <div>
          <h2>{complete ? "Ready" : "Incomplete"}</h2>
          <p>
            {complete
              ? "Accepted quote items, operation tasks, and final confirmations are connected."
              : "Accepted quote items exist, but one or more reservation actions still need booking, change, cancellation, or final confirmation follow-up."}
          </p>
        </div>
        <strong>{workflowItems.filter((item) => item.taskComplete && item.finalConfirmed).length}/{workflowItems.length}</strong>
      </section>

      <section className="reservation-summary-grid">
        <article className="summary-panel">
          <h3>Accepted Quote</h3>
          <dl className="definition-list compact">
            <div>
              <dt>Version</dt>
              <dd>{reservation.acceptedQuoteVersion?.versionNo ?? "Not linked"}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                {reservation.acceptedQuoteVersion
                  ? `${reservation.acceptedQuoteVersion.currency} ${reservation.acceptedQuoteVersion.publicTotalAmount.toLocaleString()}`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt>Quote Items</dt>
              <dd>{reservation.quoteItems.length}</dd>
            </div>
          </dl>
        </article>
        <article className="summary-panel">
          <h3>Quoted Categories</h3>
          <div className="quote-category-chips">
            {quotedCategories.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="workflow-table-shell">
        <table className="workflow-table">
          <thead>
            <tr>
              <th>Required Action</th>
              <th>Quote Source</th>
              <th>Booking</th>
              <th>Change</th>
              <th>Cancel</th>
              <th>Final Confirm</th>
              <th>Task</th>
            </tr>
          </thead>
          <tbody>
            {workflowItems.map((item) => (
              <tr key={item.key}>
                <td>
                  <strong>{item.label}</strong>
                  <span className="subtext">{item.owner}</span>
                </td>
                <td>
                  {item.quoteItems.length > 0 ? (
                    item.quoteItems.slice(0, 3).map((quoteItem) => (
                      <span className="workflow-source" key={quoteItem.id}>
                        {quoteItem.snapshotItemName}
                      </span>
                    ))
                  ) : (
                    <span className="status-dot status-cancelled">Missing from quote</span>
                  )}
                </td>
                <td><MessageStatusBadge messages={item.messages} type="booking_request" /></td>
                <td><MessageStatusBadge messages={item.messages} type="change_request" /></td>
                <td><MessageStatusBadge messages={item.messages} type="cancellation_request" /></td>
                <td><MessageStatusBadge messages={item.messages} type="final_confirmation" /></td>
                <td>
                  <span className={`status-dot ${item.taskComplete ? "status-completed" : "status-cancelled"}`}>
                    {item.taskComplete ? "Done" : "Missing"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="operation-checklist-grid">
        {workflowItems.map((item) => (
          <article className={`operation-check-card ${item.taskComplete && item.finalConfirmed ? "complete" : "incomplete"}`} key={item.key}>
            <span>{item.taskComplete && item.finalConfirmed ? "Complete" : "Follow up"}</span>
            <h2>{item.label}</h2>
            <p>{item.description}</p>
            <dl className="definition-list compact">
              <div>
                <dt>Quote items</dt>
                <dd>{item.quoteItems.length}</dd>
              </div>
              <div>
                <dt>Supplier messages</dt>
                <dd>{item.messages.length}</dd>
              </div>
            </dl>
          </article>
        ))}
      </section>

      <section className="action-band">
        <div>
          <h2>Follow-up Actions</h2>
          <p>Update operation tasks or create supplier booking/change/cancellation/final confirmation messages.</p>
        </div>
        <div className="inline-actions">
          <Link className="button-secondary" href={supplierMessagesRoute}>
            Supplier Messages
          </Link>
          <Link className="button-primary" href={tasksRoute}>
            Open Tasks
          </Link>
        </div>
      </section>
    </>
  );
}

function buildWorkflowItems(reservation: ReservationDetail) {
  return REQUIRED_ACTIONS.map((action) => {
    const matchingTasks = reservation.operationTasks.filter(action.matches);
    const completedTasks = matchingTasks.filter((task) => ["done", "completed"].includes(task.status));
    const quoteItems = reservation.quoteItems.filter(action.matchesQuote);
    const messages = reservation.supplierMessages.filter(action.matchesMessage);
    const finalConfirmed = messages.some(
      (message) => message.messageType === "final_confirmation" && ["sent", "approved", "queued"].includes(message.status)
    );
    return {
      ...action,
      taskComplete: completedTasks.length > 0,
      quoteItems,
      messages,
      finalConfirmed
    };
  });
}

function MessageStatusBadge({
  messages,
  type
}: {
  messages: ReservationSupplierMessageItem[];
  type: string;
}) {
  const message = messages.find((candidate) => candidate.messageType === type);
  if (!message) {
    return <span className="status-dot status-cancelled">None</span>;
  }
  const positive = ["approved", "queued", "sending", "sent"].includes(message.status);
  return <span className={`status-dot ${positive ? "status-completed" : "status-pending"}`}>{formatLabel(message.status)}</span>;
}

function summarizeQuoteCategories(items: ReservationQuoteItem[]) {
  const categories = new Set<string>();
  for (const item of items) {
    categories.add(item.serviceSection ?? item.itemCategory);
  }
  return Array.from(categories.values()).sort();
}

async function loadReservation(reservationId: string): Promise<LoadState> {
  const demoReservation = getDemoReservationDetail(reservationId);
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    if (isDemoModeEnabled() && demoReservation) return { status: "ready", reservation: demoReservation };
    return {
      status: "auth-required",
      message:
        "This page reads reservation detail through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl(`/api/reservations/${reservationId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (isDemoModeEnabled() && (response.status === 401 || response.status === 403 || response.status === 404) && demoReservation) {
      return { status: "ready", reservation: demoReservation };
    }
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Reservation not found" };
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown reservation detail API error"
    };
  }

  return { status: "ready", reservation: payload.data };
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
