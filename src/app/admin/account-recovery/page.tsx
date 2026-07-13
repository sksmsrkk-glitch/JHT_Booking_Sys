import type { Route } from "next";
import Link from "next/link";
import { AccountRecoveryActions } from "@/components/admin/AccountRecoveryActions";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;
type RecoveryRequest = {
  id: string;
  recoveryType: string;
  accountType: string;
  submittedEmail: string | null;
  companyName: string | null;
  contactName: string | null;
  phoneLastFour: string | null;
  matchedEmail: string | null;
  result: string;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
};
type LoadState =
  | { status: "ready"; requests: RecoveryRequest[] }
  | { status: "auth-required" | "error"; message: string };

export default async function AccountRecoveryAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const selectedStatus = (await searchParams).status ?? "pending";
  const loadState = await loadRequests(selectedStatus);
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Account Recovery</h1>
          <p>Review email lookup requests that could not be verified automatically and audit password reset requests.</p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>Back to Admin</Link>
      </div>
      <form className="toolbar recovery-admin-filter" action="/admin/account-recovery">
        <label>
          Status
          <select defaultValue={selectedStatus} name="status">
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All</option>
          </select>
        </label>
        <button className="button-primary" type="submit">Filter</button>
      </form>
      {loadState.status !== "ready" ? (
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>Recovery requests could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : <RecoveryTable requests={loadState.requests} />}
    </>
  );
}

function RecoveryTable({ requests }: { requests: RecoveryRequest[] }) {
  if (requests.length === 0) {
    return <section className="empty-state"><h2>No recovery requests</h2><p>No requests match this status.</p></section>;
  }
  return (
    <section className="table-shell" aria-label="Account recovery requests">
      <table>
        <thead><tr><th>Requested</th><th>Type</th><th>Account</th><th>Submitted identity</th><th>Result</th><th>Action</th></tr></thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id}>
              <td>{formatDateTime(request.createdAt)}</td>
              <td>{formatLabel(request.recoveryType)}</td>
              <td>{formatLabel(request.accountType)}</td>
              <td>
                <strong>{request.contactName ?? request.submittedEmail ?? "Not supplied"}</strong>
                <span className="subtext">{request.companyName ?? "-"}</span>
                <span className="subtext">
                  {request.phoneLastFour ? `Phone ending ${request.phoneLastFour}` : request.submittedEmail ?? "-"}
                </span>
                {request.matchedEmail ? <span className="subtext">Matched: {request.matchedEmail}</span> : null}
              </td>
              <td><span className={`status-dot status-${request.status}`}>{formatLabel(request.result)}</span></td>
              <td>
                {request.status === "pending" ? <AccountRecoveryActions requestId={request.id} /> : request.resolutionNote ?? formatLabel(request.status)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadRequests(status: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) return { status: "auth-required", message: "Admin login is required." };
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL("/api/admin/account-recovery", `${protocol}://${host}`);
  url.searchParams.set("status", status);
  const response = await fetch(url, { cache: "no-store", headers: { authorization } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload?.error ?? "Unknown account recovery API error"
    };
  }
  return { status: "ready", requests: payload?.data ?? [] };
}

function formatLabel(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
