import type { Route } from "next";
import Link from "next/link";
import { WorkflowLedger } from "@/components/workflow/WorkflowLedger";
import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import { ensureWorkflowThread, getWorkflowThreadByCode, resolveWorkflowSeedByCode } from "@/features/workflow/queries";
import type { WorkflowThreadDetail } from "@/features/workflow/types";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { getAgencyPageContext } from "@/lib/api/server-page-context";

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
  try {
    const { supabase, user } = await getAgencyPageContext();
    const existing = await getWorkflowThreadByCode(supabase, workflowCode, { partnerVisibleOnly: true });
    if (existing) return { status: "ready", workflow: existing, previewMode: false };

    const seed = await resolveWorkflowSeedByCode(supabase, workflowCode);
    if (seed && seed.agencyAccountId === user.agencyAccountId) {
      await ensureWorkflowThread(supabase, {
        workflowCode: seed.workflowCode ?? workflowCode,
        title: seed.title ?? workflowCode,
        agencyAccountId: seed.agencyAccountId,
        agencyInquiryId: seed.agencyInquiryId,
        quoteCaseId: seed.quoteCaseId,
        reservationId: seed.reservationId,
        currentInvoiceId: null,
        createdBy: null
      });
      const workflow = await getWorkflowThreadByCode(supabase, workflowCode, { partnerVisibleOnly: true });
      if (workflow) return { status: "ready", workflow, previewMode: false };
    }
  } catch {
    // 아래 개발 미리보기 경로에서만 샘플 원장을 사용하고 운영에서는 일반 오류로 종료합니다.
    if (!isDemoModeEnabled()) return { status: "error", message: "Workflow could not load" };
  }

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
