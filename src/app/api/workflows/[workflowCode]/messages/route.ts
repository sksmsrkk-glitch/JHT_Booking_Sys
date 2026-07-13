import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import { ensureWorkflowThread, getWorkflowThreadByCode, resolveWorkflowSeedByCode } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { isDemoModeEnabled } from "@/lib/api/guards";
import { created, fail, HttpError, optionalString, readJson, requireString } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workflowCode: string }> };

const MESSAGE_TYPES = new Set([
  "general",
  "new_inquiry",
  "quote_revision",
  "hotel_change",
  "meal_change",
  "vehicle_change",
  "attraction_change",
  "cancellation",
  "invoice_question",
  "finance_follow_up",
  "operation_update"
]);

const ACTION_CATEGORIES = new Set(["hotel", "meal", "vehicle", "attraction", "guide", "invoice", "finance", "inspection", "other"]);

export async function POST(request: Request, context: RouteContext) {
  try {
    const { workflowCode } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    // body를 읽기 전에 actor를 먼저 확정합니다.
    // 이렇게 해야 인증 실패 요청이 잘못된 JSON body 때문에 400으로 가려지지 않고 401/403 흐름으로 처리됩니다.
    let actor;
    try {
      actor = await resolveActor(supabase);
    } catch (error) {
      if (!isDemoModeEnabled()) throw error;
      const body = await readJson<Record<string, unknown>>(request);
      const text = requireString(body.body, "body");
      const messageType = normalizeSetValue(body.messageType, MESSAGE_TYPES, "general");
      const requestedVisibility = normalizeSetValue(body.visibility, new Set(["partner_visible", "internal_only"]), "partner_visible");
      const demo = getDemoWorkflowByCode(workflowCode);
      return created({
        preview: true,
        message: {
          id: `preview-message-${Date.now()}`,
          threadId: demo?.id ?? `preview-${workflowCode}`,
          senderType: "internal",
          senderProfileId: "22222222-2222-4222-8222-222222222222",
          senderAgencyUserId: null,
          senderName: "Preview user",
          senderEmail: null,
          messageType,
          body: text,
          visibility: requestedVisibility,
          linkedQuoteVersionId: null,
          linkedInvoiceId: null,
          createdAt: new Date().toISOString()
        }
      });
    }
    const body = await readJson<Record<string, unknown>>(request);
    const text = requireString(body.body, "body");
    const messageType = normalizeSetValue(body.messageType, MESSAGE_TYPES, "general");
    const requestedVisibility = normalizeSetValue(body.visibility, new Set(["partner_visible", "internal_only"]), "partner_visible");
    const visibility = actor.type === "agency" ? "partner_visible" : requestedVisibility;
    // workflowCode가 아직 workflow_threads에 없더라도 quote/inquiry/reservation 중 하나와 매칭되면
    // 원장을 자동으로 생성합니다. 파트너와 주고받는 모든 메시지가 같은 코드에 붙게 하기 위함입니다.
    const seed = await resolveWorkflowSeedByCode(supabase, workflowCode);
    const thread =
      (await getWorkflowThreadByCode(supabase, workflowCode)) ??
      (seed
        ? await ensureWorkflowThread(supabase, { ...seed, createdBy: actor.profileId })
        : null);

    if (!thread) throw new HttpError(404, "Workflow thread not found");
    if (actor.type === "agency" && thread.agencyAccountId !== actor.agencyAccountId) {
      throw new HttpError(403, "Workflow does not belong to this agency");
    }

    const nextStatus = actor.type === "agency" ? "waiting_internal" : "waiting_partner";
    // 메시지 작성 주체에 따라 다음 follow-up 책임자를 상태로 표현합니다.
    // 파트너가 쓰면 내부 대기, 내부가 답하면 파트너 대기 상태가 됩니다.
    const actionTitle = optionalString(body.actionTitle);
    const actionCategory = normalizeSetValue(body.actionCategory, ACTION_CATEGORIES, "other");
    const { data: appendResult, error: appendError } = await supabase.rpc("append_workflow_message", {
      p_thread_id: thread.id,
      p_sender_type: actor.type,
      p_sender_profile_id: actor.profileId,
      p_sender_agency_user_id: actor.agencyUserId,
      p_sender_name: actor.displayName,
      p_sender_email: actor.email,
      p_message_type: messageType,
      p_body: text,
      p_visibility: visibility,
      p_next_status: nextStatus,
      p_action_title: actionTitle,
      p_action_category: actionCategory,
      p_action_details: optionalString(body.actionDetails)
    });
    if (appendError) throw new HttpError(500, appendError.message);
    const message = appendResult?.message;
    let actionItem = appendResult?.actionItem ?? null;
    if (!message?.id) throw new HttpError(500, "Workflow message was not returned");
    // 메시지와 동시에 action item을 만들 수 있게 해서
    // "호텔 변경 요청", "인보이스 확인 필요" 같은 후속 작업이 커뮤니케이션 원장에 남습니다.
    await writeAuditLog(supabase, {
      actorProfileId: actor.profileId,
      action: "workflow.message.created",
      entityTable: "workflow_messages",
      entityId: message.id,
      afterData: { workflowCode, messageType, visibility, actionItemId: actionItem?.id ?? null }
    });

    return created({ message, actionItem });
  } catch (error) {
    return fail(error);
  }
}

async function resolveActor(supabase: any) {
  try {
    const internalUser = await requireInternalUser(supabase);
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, email")
      .eq("id", internalUser.profileId)
      .maybeSingle();

    return {
      type: "internal" as const,
      profileId: internalUser.profileId,
      agencyUserId: null,
      agencyAccountId: null,
      displayName: profile?.display_name ?? profile?.email ?? "JHT Internal",
      email: profile?.email ?? null
    };
  } catch (error) {
    if (!(error instanceof HttpError) || ![401, 403].includes(error.status)) throw error;
    const agencyUser = await requireAgencyUser(supabase);
    return {
      type: "agency" as const,
      profileId: null,
      agencyUserId: agencyUser.agencyUserId,
      agencyAccountId: agencyUser.agencyAccountId,
      displayName: agencyUser.name ?? agencyUser.email ?? "Agency user",
      email: agencyUser.email ?? null
    };
  }
}

function normalizeSetValue(value: unknown, set: Set<string>, fallback: string) {
  const normalized = optionalString(value) ?? fallback;
  if (!set.has(normalized)) return fallback;
  return normalized;
}
