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

      <section className="workflow-list-grid" aria-label="Partner workflow communication list">
        {workflows.map((workflow) => (
          <Link className="workflow-list-card" href={`/agency/workflows/${workflow.workflowCode}` as Route} key={workflow.id}>
            <div>
              <strong>{workflow.workflowCode}</strong>
              <span className={`status-dot status-${workflow.status}`}>{formatLabel(workflow.status)}</span>
            </div>
            <h2>{workflow.title}</h2>
            <p>{workflow.agencyName ?? "JHT workflow"}</p>
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
