/**
 * @file 한글 책임: Next.js App Router의 `/admin/automation/failed-jobs` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { QuoteExportRetryAction } from "@/components/admin/QuoteExportRetryAction";
import { SupplierMessageActions } from "@/components/admin/SupplierMessageActions";
import type { FailedAutomationJob } from "@/features/automation/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; jobs: FailedAutomationJob[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminFailedJobsPage() {
  const loadState = await loadJobs();

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Automation</p>
          <h1>Failed Jobs</h1>
          <p>Operational recovery queue for failed supplier deliveries and Quote XLSX exports.</p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Failed jobs could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <FailedJobsTable jobs={loadState.jobs} /> : null}

      <section className="notice">
        <h2>Recovery Guardrails</h2>
        <ul className="clean-list">
          <li>Supplier message requeue keeps approval rules and writes provider event evidence.</li>
          <li>Quote export retry reuses the original storage path and audit trail.</li>
          <li>Agency Portal never sees failed job internals, supplier outbox, or export errors.</li>
        </ul>
      </section>
    </>
  );
}

function FailedJobsTable({ jobs }: { jobs: FailedAutomationJob[] }) {
  if (jobs.length === 0) {
    return (
      <section className="empty-state">
        <h2>No failed jobs</h2>
        <p>Failed supplier deliveries and Quote XLSX exports will appear here.</p>
      </section>
    );
  }

  const supplierCount = jobs.filter((job) => job.kind === "supplier_message").length;
  const exportCount = jobs.filter((job) => job.kind === "quote_export").length;

  return (
    <>
      <section className="metric-row">
        <article className="metric-card">
          <span>Total Failed</span>
          <strong>{jobs.length}</strong>
        </article>
        <article className="metric-card">
          <span>Supplier Messages</span>
          <strong>{supplierCount}</strong>
        </article>
        <article className="metric-card">
          <span>Quote Exports</span>
          <strong>{exportCount}</strong>
        </article>
      </section>
      <section className="table-shell" aria-label="Failed automation jobs">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Context</th>
              <th>Error</th>
              <th>Failed</th>
              <th>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.title}</strong>
                  <span className={`status-dot status-${job.status}`}>{formatKind(job.kind)}</span>
                </td>
                <td>
                  <JobContext job={job} />
                </td>
                <td>{job.errorMessage ? <span className="danger-text">{job.errorMessage}</span> : "No error message"}</td>
                <td>{formatDateTime(job.failedAt ?? job.createdAt)}</td>
                <td>
                  <div className="inline-actions">
                    <Link className="button-secondary" href={job.detailHref as Route}>
                      Detail
                    </Link>
                    <RecoveryAction job={job} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function JobContext({ job }: { job: FailedAutomationJob }) {
  if (job.kind === "supplier_message") {
    return (
      <>
        {job.supplierMessage.reservationCode ?? "Reservation not linked"}
        <span className="subtext">
          {job.supplierMessage.supplierName ?? "Supplier unknown"} / {formatKind(job.supplierMessage.channel)} /{" "}
          {formatKind(job.supplierMessage.riskLevel)}
        </span>
      </>
    );
  }

  return (
    <>
      {job.quoteExport.caseCode ?? "Quote case not linked"}
      <span className="subtext">
        {job.quoteExport.tourName ?? "Tour name not set"}
        {job.quoteExport.versionNo ? ` / Version ${job.quoteExport.versionNo}` : ""}
      </span>
      {job.quoteExport.storagePath ? <span className="subtext">{job.quoteExport.storagePath}</span> : null}
    </>
  );
}

function RecoveryAction({ job }: { job: FailedAutomationJob }) {
  if (job.kind === "supplier_message") {
    return (
      <SupplierMessageActions
        approvedAt={job.supplierMessage.approvedAt}
        messageId={job.supplierMessage.id}
        messageType={job.supplierMessage.messageType}
        secondApprovedAt={job.supplierMessage.secondApprovedAt}
        status={job.supplierMessage.status}
      />
    );
  }

  return <QuoteExportRetryAction exportId={job.quoteExport.id} status={job.status} />;
}

async function loadJobs(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message:
        "This page reads failed automation jobs through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/automation/failed-jobs", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown failed jobs API error"
    };
  }

  return { status: "ready", jobs: payload.data ?? [] };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatKind(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
