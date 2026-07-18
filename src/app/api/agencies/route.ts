/**
 * @file 한글 책임: `/api/agencies` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listAgencyAccountPage } from "@/features/agency/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, okPaginated, readJson, requireString, requireUuid } from "@/lib/api/http";
import { parsePagination } from "@/lib/api/pagination";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { instrumentApiRoute } from "@/lib/api/telemetry";

export const GET = instrumentApiRoute("GET /api/agencies", async (request: Request) => {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const pagination = parsePagination(url.searchParams);
    const agencies = await listAgencyAccountPage(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    }, pagination);

    return okPaginated(agencies.items, agencies.pagination);
  } catch (error) {
    return fail(error);
  }
});

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);

    const { data, error } = await supabase
      .from("agency_accounts")
      .insert({
        company_id: requireUuid(body.companyId, "companyId"),
        name: requireString(body.name, "name"),
        country_code: optionalString(body.countryCode),
        email_domain: optionalString(body.emailDomain),
        phone: optionalString(body.phone),
        website: optionalString(body.website),
        billing_currency: optionalString(body.billingCurrency) ?? "KRW",
        google_drive_folder_url: optionalString(body.googleDriveFolderUrl),
        status: "active"
      })
      .select("id, name, country_code, billing_currency, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "agency_account.created",
      entityTable: "agency_accounts",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
