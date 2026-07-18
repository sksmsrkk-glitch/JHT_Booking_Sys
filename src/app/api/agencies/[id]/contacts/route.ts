/**
 * @file 한글 책임: `/api/agencies/[id]/contacts` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const agencyAccountId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    await assertAgencyExists(supabase, agencyAccountId);

    const { data, error } = await supabase
      .from("agency_contacts")
      .insert({
        agency_account_id: agencyAccountId,
        name: requireString(body.name, "name"),
        email: optionalString(body.email),
        phone: optionalString(body.phone),
        role: optionalString(body.role),
        receives_quotes: optionalBoolean(body.receivesQuotes) ?? false,
        receives_invoices: optionalBoolean(body.receivesInvoices) ?? false,
        notes: optionalString(body.notes),
        status: "active"
      })
      .select("id, agency_account_id, name, email, role, receives_quotes, receives_invoices, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "agency_contact.created",
      entityTable: "agency_contacts",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

async function assertAgencyExists(supabase: any, agencyAccountId: string) {
  const { data, error } = await supabase.from("agency_accounts").select("id").eq("id", agencyAccountId).maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Overseas agency not found");
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return Boolean(value);
}
