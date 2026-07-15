import type { Route } from "next";
import Link from "next/link";
import type { WorkflowThreadSummary } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { PaginationControls } from "@/components/PaginationControls";
import { buildPaginationMeta, type PaginationMeta } from "@/lib/api/pagination";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AgencyWorkflowsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const loadState = await loadWorkflows(params);
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

      {loadState.error ? (
        <section className="notice warning">
          <h2>Communication could not load</h2>
          <p>{loadState.error}</p>
        </section>
      ) : null}

      <WorkflowDatabase pagination={loadState.pagination} workflows={workflows} />
      <PaginationControls action="/agency/workflows" pagination={loadState.pagination} />
    </>
  );
}

function WorkflowDatabase({ workflows, pagination }: { workflows: WorkflowThreadSummary[]; pagination: PaginationMeta }) {
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
          <strong>{pagination.total}</strong>
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

async function loadWorkflows(params: { page?: string; pageSize?: string }): Promise<{
  workflows: WorkflowThreadSummary[];
  pagination: PaginationMeta;
  previewMode: boolean;
  error?: string;
}> {
  const { headerStore, authorization } = await getPageAuthorization();
  const url = buildInternalApiUrl("/api/workflows", headerStore);
  if (params.page) url.searchParams.set("page", params.page);
  if (params.pageSize) url.searchParams.set("pageSize", params.pageSize);
  const response = await fetch(url, {
    headers: authorization ? { authorization } : {},
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) {
    return {
      workflows: [],
      pagination: buildPaginationMeta({ page: 1, pageSize: 20 }, 0, 0),
      previewMode: false,
      error: payload.error ?? "An active partner session is required."
    };
  }
  return {
    workflows: payload.data ?? [],
    pagination: payload.pagination,
    previewMode: Boolean(!authorization || payload.data?.[0]?.preview)
  };
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
