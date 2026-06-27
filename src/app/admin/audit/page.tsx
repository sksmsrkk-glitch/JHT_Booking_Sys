import type { Route } from "next";
import Link from "next/link";
import { getPageAuthorization } from "@/lib/api/page-session";
import { RISK_LEVELS } from "@/features/audit/queries";
import type { AuditLogListItem } from "@/features/audit/types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ riskLevel?: string; entityTable?: string; action?: string }>;

type LoadState =
  | { status: "ready"; logs: AuditLogListItem[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadLogs(filters);

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Audit Log</h1>
          <p>
            Read-only trail for high-risk actions, approvals, request IDs, and automation
            events.
          </p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <section className="action-band">
        <div>
          <h2>API Call Trail</h2>
          <p>Inspect webhook, automation, and API call traces separately from high-risk business audit events.</p>
        </div>
        <Link className="button-primary" href={"/admin/audit/api-logs" as Route}>
          View API Logs
        </Link>
      </section>

      <form className="toolbar" action="/admin/audit">
        <label>
          Risk
          <select name="riskLevel" defaultValue={filters.riskLevel ?? ""}>
            <option value="">All risk levels</option>
            {RISK_LEVELS.map((riskLevel) => (
              <option key={riskLevel} value={riskLevel}>
                {formatLabel(riskLevel)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entity Table
          <input name="entityTable" defaultValue={filters.entityTable ?? ""} placeholder="supplier_message_outbox" />
        </label>
        <label>
          Action
          <input name="action" defaultValue={filters.action ?? ""} placeholder="approved, created, staged" />
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
          <h2>Audit logs could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <AuditTable logs={loadState.logs} /> : null}

      <section className="notice">
        <h2>Audit Guardrails</h2>
        <ul className="clean-list">
          <li>High-risk actions should write audit_logs before production release.</li>
          <li>Do not log secrets, provider tokens, passport numbers, or unnecessary PII.</li>
          <li>Audit rows are internal read/insert only.</li>
        </ul>
      </section>
    </>
  );
}

function AuditTable({ logs }: { logs: AuditLogListItem[] }) {
  if (logs.length === 0) {
    return (
      <section className="empty-state">
        <h2>No audit logs found</h2>
        <p>High-risk actions and automation events will appear here.</p>
      </section>
    );
  }

  return (
    <section className="table-shell" aria-label="Audit logs">
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Entity</th>
            <th>Risk</th>
            <th>Actor</th>
            <th>Evidence</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>
                <strong>{log.action}</strong>
                {log.requestId ? <span className="subtext">Request: {log.requestId}</span> : null}
              </td>
              <td>
                {log.entityTable}
                {log.entityId ? <span className="subtext">{log.entityId}</span> : null}
              </td>
              <td>
                <span className={`status-dot status-${log.riskLevel}`}>{formatLabel(log.riskLevel)}</span>
              </td>
              <td>{log.actorEmail ?? log.actorProfileId ?? "System"}</td>
              <td>{formatEvidence(log)}</td>
              <td>{formatDateTime(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadLogs(filters: {
  riskLevel?: string;
  entityTable?: string;
  action?: string;
}): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads audit logs through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/audit", filters, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown audit API error"
    };
  }

  return { status: "ready", logs: payload.data ?? [] };
}

function buildInternalApiUrl(
  path: string,
  filters: { riskLevel?: string; entityTable?: string; action?: string },
  headerStore: Headers
) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.riskLevel) url.searchParams.set("riskLevel", filters.riskLevel);
  if (filters.entityTable) url.searchParams.set("entityTable", filters.entityTable);
  if (filters.action) url.searchParams.set("action", filters.action);
  return url;
}

function formatEvidence(log: AuditLogListItem) {
  const parts = [];
  if (log.hasBeforeData) parts.push("before");
  if (log.hasAfterData) parts.push("after");
  if (log.hasApprovalData) parts.push("approval");
  return parts.length > 0 ? parts.join(" / ") : "none";
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
