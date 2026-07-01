import type { Route } from "next";
import Link from "next/link";
import type { WorkflowThreadSummary } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

export default async function AdminWorkflowsPage() {
  const loadState = await loadWorkflows();
  const workflows = loadState.workflows;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Workflow Communication</h1>
          <p>One communication ledger for each inquiry, quote, confirmation, invoice, finance, and guide expense code.</p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>
          Dashboard
        </Link>
      </div>

      {loadState.previewMode ? (
        <section className="notice warning">
          <h2>Preview data</h2>
          <p>Supabase login is not active, so sample workflow communication rows are shown.</p>
        </section>
      ) : null}

      <section className="workflow-list-grid" aria-label="Workflow communication list">
        {workflows.map((workflow) => (
          <Link className="workflow-list-card" href={`/admin/workflows/${workflow.workflowCode}` as Route} key={workflow.id}>
            <div>
              <strong>{workflow.workflowCode}</strong>
              <span className={`status-dot status-${workflow.status}`}>{formatLabel(workflow.status)}</span>
            </div>
            <h2>{workflow.title}</h2>
            <p>{workflow.agencyName ?? "Partner not linked"}</p>
            <span>{workflow.lastMessageAt ? `Last: ${formatDate(workflow.lastMessageAt)}` : "No message yet"}</span>
          </Link>
        ))}
      </section>
    </>
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
