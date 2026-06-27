import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import {
  SUPPLIER_MESSAGE_CHANNELS,
  SUPPLIER_MESSAGE_STATUSES,
  SUPPLIER_MESSAGE_TYPES
} from "@/features/supplier-comms/queries";
import type { SupplierMessageListItem } from "@/features/supplier-comms/types";
import type { ReservationListItem } from "@/features/reservation/types";
import type { SupplierListItem } from "@/features/supplier/types";
import { SupplierMessageActions } from "@/components/admin/SupplierMessageActions";
import { SupplierMessageDraftForm } from "@/components/admin/SupplierMessageDraftForm";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  status?: string;
  channel?: string;
  messageType?: string;
}>;

type LoadState =
  | {
      status: "ready";
      messages: SupplierMessageListItem[];
      reservations: ReservationListItem[];
      suppliers: SupplierListItem[];
    }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminSupplierMessagesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadMessages(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Supplier Messages</h1>
          <p>
            Approval-gated email/Kakao outbox for Domestic Supplier booking, change,
            cancellation, and final confirmation messages.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/supplier-messages">
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All statuses</option>
            {SUPPLIER_MESSAGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {formatLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Channel
          <select name="channel" defaultValue={filters.channel ?? ""}>
            <option value="">All channels</option>
            {SUPPLIER_MESSAGE_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {formatLabel(channel)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Message Type
          <select name="messageType" defaultValue={filters.messageType ?? ""}>
            <option value="">All types</option>
            {SUPPLIER_MESSAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
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
          <h2>Approval Flow</h2>
          <p>
            Drafts are created by `POST /api/supplier-messages/draft`, approved by
            `/approve`, and queued by `/send`. Cancellation requests require second approval.
          </p>
        </div>
        <span className="status-dot status-live">Approval Gated</span>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Create Supplier Draft</h2>
          <p>Drafts stay internal until approval and queueing are explicitly performed.</p>
        </div>
        <SupplierMessageDraftForm
          reservations={loadState.status === "ready" ? loadState.reservations : []}
          suppliers={loadState.status === "ready" ? loadState.suppliers : []}
        />
      </section>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Supplier messages could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <SupplierMessageTable messages={loadState.messages} /> : null}

      <section className="notice">
        <h2>Boundary Guardrails</h2>
        <ul className="clean-list">
          <li>Supplier outbox records reference domestic_supplier_id, never agency_id.</li>
          <li>Messages cannot be sent until approval fields satisfy database checks.</li>
          <li>Agency Portal cannot read supplier_message_outbox or supplier_message_events.</li>
        </ul>
      </section>
    </>
  );
}

function SupplierMessageTable({ messages }: { messages: SupplierMessageListItem[] }) {
  if (messages.length === 0) {
    return (
      <section className="empty-state">
        <h2>No supplier messages found</h2>
        <p>Draft supplier booking or confirmation messages from a reservation workflow.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Supplier message outbox">
      <table>
        <thead>
          <tr>
            <th>Message</th>
            <th>Reservation</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Approval</th>
            <th>Channel</th>
            <th>Events</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => (
            <tr key={message.id}>
              <td>
                <Link className="strong-link" href={`/admin/supplier-messages/${message.id}` as Route}>
                  {message.subject ?? formatLabel(message.messageType)}
                </Link>
                <span className="subtext">{formatLabel(message.messageType)}</span>
                {message.errorMessage ? <span className="subtext danger-text">{message.errorMessage}</span> : null}
              </td>
              <td>{message.reservationCode ?? message.reservationId}</td>
              <td>
                {message.domesticSupplierName ?? message.domesticSupplierId}
                {message.supplierContactName ? <span className="subtext">{message.supplierContactName}</span> : null}
              </td>
              <td>
                <span className={`status-dot status-${message.status}`}>{formatLabel(message.status)}</span>
                <span className="subtext">{formatLabel(message.riskLevel)} risk</span>
              </td>
              <td>{formatApprovalState(message)}</td>
              <td>{formatLabel(message.channel)}</td>
              <td>{message.eventCount}</td>
              <td>
                <SupplierMessageActions
                  approvedAt={message.approvedAt}
                  messageId={message.id}
                  messageType={message.messageType}
                  secondApprovedAt={message.secondApprovedAt}
                  status={message.status}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadMessages(filters: {
  status?: string;
  channel?: string;
  messageType?: string;
}): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads supplier messages through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [messageResponse, reservationResponse, supplierResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/supplier-messages", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/reservations", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/domestic-suppliers", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [messagePayload, reservationPayload, supplierPayload] = await Promise.all([
    messageResponse.json(),
    reservationResponse.json(),
    supplierResponse.json()
  ]);

  const failedResponse = [messageResponse, reservationResponse, supplierResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message:
        messagePayload.error ??
        reservationPayload.error ??
        supplierPayload.error ??
        "Unknown supplier message API error"
    };
  }

  return {
    status: "ready",
    messages: messagePayload.data ?? [],
    reservations: reservationPayload.data ?? [],
    suppliers: supplierPayload.data ?? []
  };
}

function buildInternalApiUrl(
  path: string,
  filters: { status?: string; channel?: string; messageType?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.channel) url.searchParams.set("channel", filters.channel);
  if (filters.messageType) url.searchParams.set("messageType", filters.messageType);
  return url;
}

function formatApprovalState(message: SupplierMessageListItem) {
  if (message.messageType === "cancellation_request") {
    if (message.secondApprovedAt) return "Second approved";
    if (message.approvedAt) return "Needs second approval";
    return "Needs first approval";
  }
  return message.approvedAt ? "Approved" : "Needs approval";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
