import type { Route } from "next";
import Link from "next/link";
import type { ReadinessReport } from "@/lib/domain/readiness";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type LoadState =
  | { status: "ready"; report: ReadinessReport }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

const adminRoute = "/admin" as Route;

export default async function AdminReadinessPage() {
  const loadState = await loadReadiness();

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>V1 Readiness</h1>
            <p>Deployment and real database connection checklist for the v1 operations platform.</p>
          </div>
          <Link className="button-secondary" href={adminRoute}>
            Back to Admin
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>Readiness could not load</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const report = loadState.report;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>V1 Readiness</h1>
          <p>Check environment setup and final workflow gates before connecting the real DB and domain.</p>
        </div>
        <Link className="button-secondary" href={adminRoute}>
          Back to Admin
        </Link>
      </div>

      <section className="metric-row">
        <article className="metric-card">
          <span>Status</span>
          <strong>{report.status === "ready" ? "Ready" : "Blocked"}</strong>
        </article>
        <article className="metric-card">
          <span>Required Env</span>
          <strong>
            {report.summary.requiredConfigured}/{report.summary.requiredTotal}
          </strong>
        </article>
        <article className="metric-card">
          <span>Optional Missing</span>
          <strong>{report.summary.optionalMissing}</strong>
        </article>
        <article className="metric-card">
          <span>DB Smoke</span>
          <strong>
            {report.smokeSummary ? `${report.smokeSummary.ready}/${report.smokeSummary.total}` : "n/a"}
          </strong>
        </article>
        <article className="metric-card">
          <span>Storage</span>
          <strong>
            {report.storageSummary ? `${report.storageSummary.ready}/${report.storageSummary.total}` : "n/a"}
          </strong>
        </article>
        <article className="metric-card">
          <span>Workflow Gates</span>
          <strong>{report.workflowSummary?.total ?? report.workflowChecks.length}</strong>
        </article>
        <article className="metric-card">
          <span>Launch Checks</span>
          <strong>{report.launchSummary?.total ?? report.launchChecks?.length ?? 0}</strong>
        </article>
      </section>

      <section className={`notice ${report.status === "ready" ? "" : "warning"}`}>
        <h2>{report.status === "ready" ? "Required configuration is present" : "Required configuration is missing"}</h2>
        <p>
          Generated at {formatDateTime(report.generatedAt)}. This page shows configuration presence only; secret values are never displayed.
        </p>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Environment Checks</h2>
          <span>{report.envChecks.length} checks</span>
        </div>
        <section className="table-shell" aria-label="Readiness environment checks">
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Group</th>
                <th>Required</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.envChecks.map((check) => (
                <tr key={check.key}>
                  <td>
                    <strong>{check.label}</strong>
                    <span className="subtext">{check.envName}</span>
                  </td>
                  <td>{check.group}</td>
                  <td>{check.required ? "Required" : "Optional"}</td>
                  <td>
                    <span className={`status-dot status-${check.status}`}>{formatLabel(check.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Database Smoke Checks</h2>
          <span>{report.smokeChecks.length} checks</span>
        </div>
        {report.smokeChecks.length > 0 ? (
          <section className="table-shell" aria-label="Readiness database smoke checks">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Group</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {report.smokeChecks.map((check) => (
                  <tr key={check.key}>
                    <td>
                      <strong>{check.label}</strong>
                      <span className="subtext">{check.table}</span>
                    </td>
                    <td>{check.group}</td>
                    <td>
                      <span className={`status-dot status-${check.status}`}>{formatLabel(check.status)}</span>
                    </td>
                    <td>{check.error ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No smoke checks returned</h2>
            <p>Service role configuration may be missing or the readiness API could not run checks.</p>
          </section>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Storage Checks</h2>
          <span>{report.storageChecks.length} checks</span>
        </div>
        {report.storageChecks.length > 0 ? (
          <section className="table-shell" aria-label="Readiness storage checks">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Group</th>
                  <th>Bucket</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {report.storageChecks.map((check) => (
                  <tr key={check.key}>
                    <td>
                      <strong>{check.label}</strong>
                      <span className="subtext">{check.bucketEnvName}</span>
                    </td>
                    <td>{check.group}</td>
                    <td>{check.bucketName}</td>
                    <td>
                      <span className={`status-dot status-${check.status}`}>{formatLabel(check.status)}</span>
                    </td>
                    <td>{check.error ?? "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No storage checks returned</h2>
            <p>Service role configuration may be missing or the readiness API could not run checks.</p>
          </section>
        )}
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Workflow Gates</h2>
          <span>{report.workflowChecks.length} gates</span>
        </div>
        {report.workflowSummary ? (
          <section className="metric-row compact">
            {Object.entries(report.workflowSummary.groups).map(([group, count]) => (
              <article className="metric-card" key={group}>
                <span>{group}</span>
                <strong>{count}</strong>
              </article>
            ))}
          </section>
        ) : null}
        <section className="table-shell" aria-label="Readiness workflow gates">
          <table>
            <thead>
              <tr>
                <th>Gate</th>
                <th>Group</th>
                <th>Evidence Route</th>
              </tr>
            </thead>
            <tbody>
              {report.workflowChecks.map((check) => (
                <tr key={check.key}>
                  <td>{check.label}</td>
                  <td>{check.group}</td>
                  <td>{check.route}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Pre-Launch Checklist</h2>
          <span>{report.launchChecks?.length ?? 0} checks</span>
        </div>
        {report.launchSummary ? (
          <section className="metric-row compact">
            {Object.entries(report.launchSummary.groups).map(([group, count]) => (
              <article className="metric-card" key={group}>
                <span>{group}</span>
                <strong>{count}</strong>
              </article>
            ))}
          </section>
        ) : null}
        {report.launchChecks && report.launchChecks.length > 0 ? (
          <section className="table-shell" aria-label="Pre-launch checklist">
            <table>
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Group</th>
                  <th>Evidence</th>
                </tr>
              </thead>
              <tbody>
                {report.launchChecks.map((check) => (
                  <tr key={check.key}>
                    <td>{check.label}</td>
                    <td>{check.group}</td>
                    <td>{check.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="empty-state compact">
            <h2>No launch checks returned</h2>
            <p>Readiness API did not include the static pre-launch checklist.</p>
          </section>
        )}
      </section>
    </>
  );
}

async function loadReadiness(): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This page requires a Supabase user JWT with an internal role."
    };
  }

  const response = await fetch(buildInternalApiUrl("/api/admin/readiness", headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown readiness API error"
    };
  }

  return { status: "ready", report: payload.data };
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
