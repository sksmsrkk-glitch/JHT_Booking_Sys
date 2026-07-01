import type { Route } from "next";
import Link from "next/link";
import { WorkflowLedger } from "@/components/workflow/WorkflowLedger";
import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import type { WorkflowThreadDetail } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ workflowCode: string }>;

type LoadState =
  | { status: "ready"; workflow: WorkflowThreadDetail; previewMode: boolean }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

export default async function AdminWorkflowPage({ params }: { params: PageParams }) {
  const { workflowCode } = await params;
  const loadState = await loadWorkflow(workflowCode);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Workflow Communication</p>
            <h1>Workflow not available</h1>
            <p>{loadState.message}</p>
          </div>
          <Link className="button-secondary" href={"/admin" as Route}>
            Back to Dashboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Workflow Communication Ledger</p>
          <h1>{loadState.workflow.workflowCode}</h1>
          <p>Manage partner communication, internal notes, and follow-up action items under one workflow code.</p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>
          Back to Dashboard
        </Link>
      </div>
      <WorkflowLedger actorType="internal" previewMode={loadState.previewMode} workflow={loadState.workflow} />
    </>
  );
}

async function loadWorkflow(workflowCode: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  const response = await fetch(buildInternalApiUrl(`/api/workflows/${encodeURIComponent(workflowCode)}`, headerStore), {
    headers: authorization ? { authorization } : {},
    cache: "no-store"
  });
  const payload = await response.json();
  if (!response.ok) return { status: "error", message: payload.error ?? "Workflow could not load" };
  if (payload.data) return { status: "ready", workflow: payload.data, previewMode: Boolean(payload.data.preview || !authorization) };

  const demo = getDemoWorkflowByCode(workflowCode);
  if (demo) return { status: "ready", workflow: demo, previewMode: true };
  return { status: "not-found", message: "No workflow thread exists for this code yet." };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}
