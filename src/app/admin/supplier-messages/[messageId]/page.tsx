/**
 * @file 한글 책임: Next.js App Router의 `/admin/supplier-messages/[messageId]` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { SupplierMessageActions } from "@/components/admin/SupplierMessageActions";
import type { SupplierMessageDetail } from "@/features/supplier-comms/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ messageId: string }>;

type LoadState =
  | { status: "ready"; message: SupplierMessageDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const supplierMessagesRoute = "/admin/supplier-messages" as Route;

export default async function AdminSupplierMessageDetailPage({ params }: { params: PageParams }) {
  const { messageId } = await params;
  const loadState = await loadMessage(messageId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>Supplier Message Detail</h1>
            <p>Inspect supplier outbox payloads, approval state, and provider events.</p>
          </div>
          <Link className="button-secondary" href={supplierMessagesRoute}>
            Back to Supplier Messages
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Message not found" : "Message could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const message = loadState.message;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Supplier Outbox</p>
          <h1>{message.subject ?? formatLabel(message.messageType)}</h1>
          <p>
            {message.reservationCode ?? message.reservationId} /{" "}
            {message.domesticSupplierName ?? message.domesticSupplierId}
          </p>
        </div>
        <Link className="button-secondary" href={supplierMessagesRoute}>
          Back to Supplier Messages
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Message State</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${message.status}`}>{formatLabel(message.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>{formatLabel(message.riskLevel)}</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd>{formatLabel(message.channel)}</dd>
            </div>
            <div>
              <dt>Idempotency Key</dt>
              <dd>{message.idempotencyKey}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Actions</h2>
          <SupplierMessageActions
            approvedAt={message.approvedAt}
            messageId={message.id}
            messageType={message.messageType}
            secondApprovedAt={message.secondApprovedAt}
            status={message.status}
          />
        </article>
      </section>

      <section className="detail-grid section-block">
        <article className="panel">
          <h2>Approval</h2>
          <dl className="definition-list">
            <div>
              <dt>First Approval</dt>
              <dd>{message.approvedAt ? `${formatDateTime(message.approvedAt)} (${message.approvedBy ?? "unknown"})` : "Not approved"}</dd>
            </div>
            <div>
              <dt>Second Approval</dt>
              <dd>
                {message.secondApprovedAt
                  ? `${formatDateTime(message.secondApprovedAt)} (${message.secondApprovedBy ?? "unknown"})`
                  : message.messageType === "cancellation_request"
                    ? "Required for cancellation"
                    : "Not required"}
              </dd>
            </div>
            <div>
              <dt>Sent At</dt>
              <dd>{message.sentAt ? formatDateTime(message.sentAt) : "Not sent"}</dd>
            </div>
            <div>
              <dt>Provider Message ID</dt>
              <dd>{message.providerMessageId ?? "Not set"}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Routing</h2>
          <dl className="definition-list">
            <div>
              <dt>Reservation</dt>
              <dd>{message.reservationCode ?? message.reservationId}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{message.domesticSupplierName ?? message.domesticSupplierId}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{message.supplierContactName ?? "No specific contact"}</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>{message.templateId ?? "Default or manual draft"}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Rendered Body</h2>
          <span>{formatLabel(message.messageType)}</span>
        </div>
        <pre className="json-preview">{message.body}</pre>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Provider Events</h2>
          <span>{message.events.length} events</span>
        </div>
        {message.events.length > 0 ? (
          <section className="table-shell" aria-label="Supplier message events">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Provider</th>
                  <th>Created</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {message.events.map((event) => (
                  <tr key={event.id}>
                    <td>{formatLabel(event.eventType)}</td>
                    <td>{event.provider ?? "Internal"}</td>
                    <td>{formatDateTime(event.createdAt)}</td>
                    <td>
                      <details className="row-details">
                        <summary>Payload</summary>
                        <pre className="json-preview">{JSON.stringify(event.providerPayload, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No provider events</h2>
            <p>Queue/send/provider callbacks will appear here.</p>
          </section>
        )}
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Metadata</h2>
          <span>Internal only</span>
        </div>
        <pre className="json-preview">{JSON.stringify(message.metadata, null, 2)}</pre>
      </section>
    </>
  );
}

async function loadMessage(messageId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads supplier message detail through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl(`/api/supplier-messages/${messageId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Supplier message not found" };
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown supplier message detail API error"
    };
  }

  return { status: "ready", message: payload.data };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
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
