/**
 * @file 한글 책임: Next.js App Router의 `/admin/workflows/[workflowCode]` 화면 또는 라우트 레이아웃을 구성합니다.
 * JHT 내부 운영자에게 허용된 데이터만 준비하고, 로딩·오류·탐색 상태가 서버 렌더링과 클라이언트 상호작용에서 일관되게 이어지도록 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import { WorkflowLedger } from "@/components/workflow/WorkflowLedger";
import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import { ensureWorkflowThread, getWorkflowThreadByCode, resolveWorkflowSeedByCode } from "@/features/workflow/queries";
import type { WorkflowThreadDetail } from "@/features/workflow/types";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { classifyPageDataError, getInternalPageContext } from "@/lib/api/server-page-context";

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
  try {
    const { supabase, user } = await getInternalPageContext();
    const existing = await getWorkflowThreadByCode(supabase, workflowCode);
    if (existing) return { status: "ready", workflow: existing, previewMode: false };

    const seed = await resolveWorkflowSeedByCode(supabase, workflowCode);
    if (seed) {
      const workflow = await ensureWorkflowThread(supabase, { ...seed, createdBy: user.profileId });
      return { status: "ready", workflow, previewMode: false };
    }
  } catch (error) {
    const failure = classifyPageDataError(error);
    if (failure.status !== "auth-required" || !isDemoModeEnabled()) return { status: "error", message: failure.message };
  }

  const demo = getDemoWorkflowByCode(workflowCode);
  if (isDemoModeEnabled() && demo) return { status: "ready", workflow: demo, previewMode: true };
  return { status: "not-found", message: "No workflow thread exists for this code yet." };
}
