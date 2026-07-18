/**
 * @file 한글 책임: Next.js App Router의 `/admin/audit/api-logs` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import type { ApiLogListItem } from "@/features/audit/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ source?: string; endpoint?: string; status?: string }>;

type LoadState =
  | { status: "ready"; logs: ApiLogListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const auditRoute = "/admin/audit" as Route;

export default async function AdminApiLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadApiLogs(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>API Logs</h1>
          <p>Operational API, webhook, and automation call trail for v1 support and debugging.</p>
        </div>
        <Link className="button-secondary" href={auditRoute}>
          Back to Audit
        </Link>
      </div>

      <form className="toolbar" action="/admin/audit/api-logs">
        <label>
          Source
          <input name="source" defaultValue={filters.source ?? ""} placeholder="gmail, automation, provider" />
        </label>
        <label>
          Endpoint
          <input name="endpoint" defaultValue={filters.endpoint ?? ""} placeholder="/api/..." />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? ""}>
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>API logs could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <ApiLogTable logs={loadState.logs} /> : null}

      <section className="notice">
        <h2>Log Guardrails</h2>
        <ul className="clean-list">
          <li>API logs are internal-only and should avoid secrets, provider tokens, passport numbers, and unnecessary PII.</li>
          <li>Use this view to inspect webhook and automation failures after the real DB is connected.</li>
          <li>High-risk business decisions remain in the audit log; this page is for technical call traces.</li>
        </ul>
      </section>
    </>
  );
}

function ApiLogTable({ logs }: { logs: ApiLogListItem[] }) {
  if (logs.length === 0) {
    return (
      <section className="empty-state">
        <h2>No API logs found</h2>
        <p>Webhook, automation, and API call traces will appear here after logging is enabled.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="API logs">
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Endpoint</th>
            <th>Status</th>
            <th>Payloads</th>
            <th>Idempotency</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{log.source}</td>
              <td>
                {log.method ?? "n/a"} {log.endpoint ?? "n/a"}
              </td>
              <td>
                <span className={`status-dot ${statusClass(log.statusCode)}`}>{log.statusCode ?? "n/a"}</span>
              </td>
              <td>{formatPayloadEvidence(log)}</td>
              <td>{log.idempotencyKey ?? "None"}</td>
              <td>{formatDateTime(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadApiLogs(filters: { source?: string; endpoint?: string; status?: string }): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This page reads API logs through the internal API, which requires an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/audit/api-logs", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown API log error"
    };
  }

  return { status: "ready", logs: payload.data ?? [] };
}

function buildInternalApiUrl(
  path: string,
  filters: { source?: string; endpoint?: string; status?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.source) url.searchParams.set("source", filters.source);
  if (filters.endpoint) url.searchParams.set("endpoint", filters.endpoint);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function statusClass(statusCode: number | null) {
  if (statusCode === null) return "status-skipped";
  if (statusCode >= 200 && statusCode < 400) return "status-live";
  if (statusCode >= 400) return "status-failed";
  return "status-ready";
}

function formatPayloadEvidence(log: ApiLogListItem) {
  const parts = [];
  if (log.hasRequestPayload) parts.push("request");
  if (log.hasResponsePayload) parts.push("response");
  return parts.length > 0 ? parts.join(" / ") : "none";
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
