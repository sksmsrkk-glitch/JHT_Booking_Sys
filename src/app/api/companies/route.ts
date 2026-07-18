/**
 * @file 한글 책임: `/api/companies` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { listCompanies } from "@/features/company/queries";
import { requireAdminUser, requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson } from "@/lib/api/http";
import { buildCompanyCreateRow } from "@/lib/domain/company.mjs";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);
    const url = new URL(request.url);
    const companies = await listCompanies(supabase, { status: url.searchParams.get("status") });
    return ok(companies);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const adminUser = await requireAdminUser(supabase);
    let row: ReturnType<typeof buildCompanyCreateRow>;
    try {
      row = buildCompanyCreateRow({
        code: typeof body.code === "string" ? body.code : "",
        nameKo: typeof body.nameKo === "string" ? body.nameKo : "",
        nameEn: typeof body.nameEn === "string" ? body.nameEn : ""
      });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Invalid company payload");
    }

    const { data, error } = await supabase
      .from("companies")
      .insert(row)
      .select("id, code, name_ko, name_en, status, created_at, updated_at")
      .single();

    if (error) {
      throw new HttpError(error.code === "23505" ? 409 : 500, error.message);
    }

    const company = {
      id: data.id,
      code: data.code,
      nameKo: data.name_ko,
      nameEn: data.name_en,
      status: data.status,
      createdAt: data.created_at ?? null,
      updatedAt: data.updated_at ?? null
    };

    await writeAuditLog(supabase, {
      actorProfileId: adminUser.profileId,
      action: "company.created",
      entityTable: "companies",
      entityId: company.id,
      riskLevel: "normal",
      afterData: company
    });

    return created(company);
  } catch (error) {
    return fail(error);
  }
}
