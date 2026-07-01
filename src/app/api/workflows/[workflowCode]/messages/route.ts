import { getDemoWorkflowByCode } from "@/features/workflow/demo-data";
import { ensureWorkflowThread, getWorkflowThreadByCode, resolveWorkflowSeedByCode } from "@/features/workflow/queries";
import { requireAgencyUser, requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
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

    // 개발/시연 중에는 로그인 없이도 포털 커뮤니케이션 UI를 눌러볼 수 있게 preview 응답을 돌려줍니다.
    // 실제 DB 저장 경로에서는 아래에서 반드시 내부 사용자 또는 파트너 사용자를 확인합니다.
    if (!request.headers.get("authorization")) {
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

    const supabase = createRequestSupabaseClient(request);
    // body를 읽기 전에 actor를 먼저 확정합니다.
    // 이렇게 해야 인증 실패 요청이 잘못된 JSON body 때문에 400으로 가려지지 않고 401/403 흐름으로 처리됩니다.
    const actor = await resolveActor(supabase);
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

    const { data: message, error: messageError } = await supabase
      .from("workflow_messages")
      .insert({
        workflow_thread_id: thread.id,
        sender_type: actor.type,
        sender_name: actor.displayName,
        sender_email: actor.email,
        message_type: messageType,
        body: text,
        visibility,
        created_by: actor.profileId
      })
      .select("id, workflow_thread_id, sender_type, sender_name, sender_email, message_type, body, visibility, linked_quote_version_id, linked_invoice_id, created_at")
      .single();

    if (messageError) throw new HttpError(500, messageError.message);

    const nextStatus = actor.type === "agency" ? "waiting_internal" : "waiting_partner";
    // 메시지 작성 주체에 따라 다음 follow-up 책임자를 상태로 표현합니다.
    // 파트너가 쓰면 내부 대기, 내부가 답하면 파트너 대기 상태가 됩니다.
    const { error: threadError } = await supabase
      .from("workflow_threads")
      .update({
        status: nextStatus,
        last_message_at: message.created_at,
        updated_by: actor.profileId
      })
      .eq("id", thread.id);

    if (threadError) throw new HttpError(500, threadError.message);

    const actionTitle = optionalString(body.actionTitle);
    let actionItem = null;
    if (actionTitle) {
      // 메시지와 동시에 action item을 만들 수 있게 해서
      // "호텔 변경 요청", "인보이스 확인 필요" 같은 후속 작업이 커뮤니케이션 원장에 남습니다.
      const category = normalizeSetValue(body.actionCategory, ACTION_CATEGORIES, "other");
      const { data: action, error: actionError } = await supabase
        .from("workflow_action_items")
        .insert({
          workflow_thread_id: thread.id,
          source_message_id: message.id,
          category,
          title: actionTitle,
          details: optionalString(body.actionDetails),
          status: "open",
          partner_visible: visibility === "partner_visible",
          created_by: actor.profileId,
          updated_by: actor.profileId
        })
        .select("id, workflow_thread_id, source_message_id, category, title, details, status, partner_visible, linked_quote_version_id, assigned_to, due_at, resolved_at, created_at")
        .single();
      if (actionError) throw new HttpError(500, actionError.message);
      actionItem = action;
    }

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
    return {
      type: "internal" as const,
      profileId: internalUser.profileId,
      agencyAccountId: null,
      displayName: "JHT Internal",
      email: null
    };
  } catch {
    const agencyUser = await requireAgencyUser(supabase);
    return {
      type: "agency" as const,
      profileId: null,
      agencyAccountId: agencyUser.agencyAccountId,
      displayName: agencyUser.name ?? "Agency user",
      email: agencyUser.email ?? null
    };
  }
}

function normalizeSetValue(value: unknown, set: Set<string>, fallback: string) {
  const normalized = optionalString(value) ?? fallback;
  if (!set.has(normalized)) return fallback;
  return normalized;
}
