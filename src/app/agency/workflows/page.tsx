import type { Route } from "next";
import Link from "next/link";
import type { WorkflowThreadSummary } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

export default async function AgencyWorkflowsPage() {
  const loadState = await loadWorkflows();
  const workflows = loadState.workflows;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>Communication</h1>
          <p>Track JHT replies, quote revision requests, booking questions, cancellation requests, and invoice questions.</p>
        </div>
        <Link className="button-secondary" href={"/agency" as Route}>
          Back to Portal
        </Link>
      </div>

      {loadState.previewMode ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Agency login is bypassed in development, so sample communication rows are shown.</p>
        </section>
      ) : null}

      <WorkflowDatabase workflows={workflows} />
    </>
  );
}

function WorkflowDatabase({ workflows }: { workflows: WorkflowThreadSummary[] }) {
  if (workflows.length === 0) {
    return (
      <section className="empty-state">
        <h2>No communication yet</h2>
        <p>JHT replies and partner requests will appear here by workflow code.</p>
      </section>
    );
  }

  const waitingCount = workflows.filter((workflow) => workflow.status === "waiting_internal").length;

  return (
    <section className="partner-database-shell" aria-label="Partner workflow communication list">
      <div className="partner-database-toolbar">
        <div>
          <p className="eyebrow">Communication Database</p>
          <h2>Workflow message ledger</h2>
        </div>
        <div className="partner-view-tabs" aria-label="Communication views">
          <span className="active">List</span>
          <span>By Status</span>
          <span>Recent</span>
        </div>
      </div>

      <div className="partner-database-metrics" aria-label="Communication metrics">
        <div>
          <span>Threads</span>
          <strong>{workflows.length}</strong>
        </div>
        <div>
          <span>Waiting JHT</span>
          <strong>{waitingCount}</strong>
        </div>
        <div>
          <span>Last update</span>
          <strong>{workflows[0]?.lastMessageAt ? formatDate(workflows[0].lastMessageAt) : "-"}</strong>
        </div>
      </div>

      <div className="partner-database-grid partner-workflows-grid">
        <div className="partner-database-header" role="row">
          <span>Workflow Code</span>
          <span>Status</span>
          <span>Group</span>
          <span>Partner</span>
          <span>Last Message</span>
          <span>Open</span>
        </div>

        {workflows.map((workflow) => (
          <Link
            className="partner-database-row"
            href={`/agency/workflows/${workflow.workflowCode}` as Route}
            key={workflow.id}
          >
            <div className="partner-database-title">
              <small>Workflow Code</small>
              <strong>{workflow.workflowCode}</strong>
            </div>
            <div className="partner-property">
              <small>Status</small>
              <span className={`status-dot status-${workflow.status}`}>{formatLabel(workflow.status)}</span>
            </div>
            <div className="partner-property">
              <small>Group</small>
              <strong>{workflow.title}</strong>
            </div>
            <div className="partner-property">
              <small>Partner</small>
              <strong>{workflow.agencyName ?? "JHT workflow"}</strong>
            </div>
            <div className="partner-property">
              <small>Last Message</small>
              <strong>{workflow.lastMessageAt ? formatDate(workflow.lastMessageAt) : "No message yet"}</strong>
            </div>
            <span className="partner-database-open">Open</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function loadWorkflows(): Promise<{ workflows: WorkflowThreadSummary[]; previewMode: boolean }> {
  const { headerStore, authorization } = await getPageAuthorization();
  const response = await fetch(buildInternalApiUrl("/api/workflows", headerStore), {
    headers: authorization ? { authorization } : {},
    cache: "no-store"
  });
  const payload = await response.json();
  return { workflows: payload.data ?? [], previewMode: Boolean(!authorization || payload.data?.[0]?.preview) };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}
