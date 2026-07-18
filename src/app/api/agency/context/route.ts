/**
 * @file 한글 책임: `/api/agency/context` API 엔드포인트의 HTTP 요청·응답 경계를 정의합니다.
 * 필요한 인증과 역할 권한을 먼저 확인하고 입력 검증을 통과한 값만 도메인·DB 계층에 전달하며 오류는 공통 응답 규약으로 변환합니다.
 */
import { requireAgencyUser } from "@/lib/api/auth";
import { fail, HttpError, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    const actor = await requireAgencyUser(supabase);
    const { data, error } = await supabase
      .from("agency_accounts")
      .select("id, name, country_code, billing_currency, lifecycle_status")
      .eq("id", actor.agencyAccountId)
      .single();
    if (error) throw new HttpError(500, error.message);
    const { data: country, error: countryError } = data.country_code
      ? await supabase
          .from("country_references")
          .select("country_name, default_currency")
          .eq("country_code", data.country_code)
          .eq("status", "active")
          .maybeSingle()
      : { data: null, error: null };
    if (countryError) throw new HttpError(500, countryError.message);
    return ok({
      agencyAccountId: data.id,
      agencyName: data.name,
      countryCode: data.country_code,
      countryName: country?.country_name ?? data.country_code,
      billingCurrency: data.billing_currency ?? country?.default_currency ?? "KRW",
      agencyUserName: actor.name,
      agencyUserEmail: actor.email
    });
  } catch (error) {
    return fail(error);
  }
}
