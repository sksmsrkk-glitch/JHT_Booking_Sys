import type { Route } from "next";
import Link from "next/link";
import { WorkflowLedger } from "@/components/workflow/WorkflowLedger";
import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import type { WorkflowThreadDetail } from "@/features/workflow/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { isDemoModeEnabled } from "@/lib/api/guards";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ workflowCode: string }>;

type LoadState =
  | { status: "ready"; workflow: WorkflowThreadDetail; previewMode: boolean }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

export default async function AgencyWorkflowPage({ params }: { params: PageParams }) {
  const { workflowCode } = await params;
  const loadState = await loadWorkflow(workflowCode);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency Portal</p>
            <h1>Workflow not available</h1>
            <p>{loadState.message}</p>
          </div>
          <Link className="button-secondary" href={"/agency" as Route}>
            Back to Portal
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Partner Communication</p>
          <h1>{loadState.workflow.workflowCode}</h1>
          <p>Send quote revisions, booking questions, cancellation requests, and invoice questions to JHT in one place.</p>
        </div>
        <Link className="button-secondary" href={"/agency" as Route}>
          Back to Portal
        </Link>
      </div>
      <WorkflowLedger actorType="agency" previewMode={loadState.previewMode} workflow={loadState.workflow} />
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
  if (isDemoModeEnabled() && demo) {
    return {
      status: "ready",
      workflow: {
        ...demo,
        messages: demo.messages.filter((message) => message.visibility === "partner_visible"),
        actionItems: demo.actionItems.filter((item) => item.partnerVisible)
      },
      previewMode: true
    };
  }
  return { status: "not-found", message: "No workflow thread exists for this code yet." };
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}
