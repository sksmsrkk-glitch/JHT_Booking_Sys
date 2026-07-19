/**
 * @file 한글 책임: `auth` 서버 API 계층에서 공통으로 사용하는 인증, 검증, 로깅 또는 응답 처리를 제공합니다.
 * 민감 정보가 응답과 로그에 노출되지 않도록 내부 오류와 외부 메시지를 분리하고 모든 라우트가 같은 보안 경계를 사용하게 합니다.
 */
import { HttpError } from "./http";
import { getVerifiedAccessTokenClaims } from "@/lib/domain/auth-session.mjs";
import { getRequestAccessToken } from "@/lib/supabase/server";

/*
 * API 권한 경계입니다.
 *
 * 이 시스템은 Overseas Agency와 Domestic Supplier, Internal Admin을 엄격히 분리해야 합니다.
 * 각 route는 body를 처리하기 전에 아래 require* 함수를 호출해 요청자가 어떤 영역에 접근 가능한지
 * 먼저 확인하는 것을 기본 원칙으로 합니다.
 */
export const INTERNAL_ROLES = [
  "admin",
  "sales",
  "operations",
  "hotel_booking",
  "vehicle_booking",
  "guide_assignment",
  "content_booking",
  "finance"
];

export async function requireCurrentUser(supabase: any) {
  /*
   * 공개키로 서명된 Supabase JWT는 getClaims()가 서명과 만료 시간을 검증합니다.
   * getUser()처럼 매 요청마다 Auth 서버를 왕복하지 않으므로 모든 보호 API의 공통 지연을 줄입니다.
   * 실제 권한과 계정 활성 상태는 아래 user_roles/agency_users 조회에서 계속 확인합니다.
   */
  const accessToken = getRequestAccessToken(supabase);
  const claims = await getVerifiedAccessTokenClaims(supabase.auth, accessToken);
  if (!claims?.sub) {
    throw new HttpError(401, "Authentication is required");
  }
  return {
    id: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : null,
    claims
  };
}

export async function requireInternalUser(supabase: any) {
  // Supabase Auth 사용자가 있더라도 user_roles에 내부 역할이 없으면 내부 관리자 API를 사용할 수 없습니다.
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", INTERNAL_ROLES);

  if (error) {
    throw new HttpError(500, error.message);
  }

  const roles = (data ?? []).map((row: { role: string }) => row.role);
  if (roles.length === 0) {
    throw new HttpError(403, "Internal role is required");
  }

  return { profileId: user.id, roles };
}

export async function requireFinanceUser(supabase: any) {
  // 인보이스, 입금, 정산, 실제 비용 데이터는 finance/admin만 접근합니다.
  const internalUser = await requireInternalUser(supabase);
  if (!internalUser.roles.some((role: string) => role === "admin" || role === "finance")) {
    throw new HttpError(403, "Finance role is required");
  }
  return internalUser;
}

export async function requireAdminUser(supabase: any) {
  const internalUser = await requireInternalUser(supabase);
  if (!internalUser.roles.includes("admin")) {
    throw new HttpError(403, "Admin role is required");
  }
  return internalUser;
}

export async function requireAgencyUser(supabase: any) {
  // 파트너 포털 사용자는 agency_users에 active로 연결된 계정만 허용합니다.
  // 이 경계 때문에 파트너는 supplier cost, internal margin, operation task를 직접 조회할 수 없습니다.
  const user = await requireCurrentUser(supabase);
  const { data, error } = await supabase
    .from("agency_users")
    .select("id, agency_account_id, email, name, is_account_admin, account_role")
    .eq("auth_user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data) {
    throw new HttpError(403, "Active agency user is required");
  }

  return {
    authUserId: user.id,
    agencyUserId: data.id,
    agencyAccountId: data.agency_account_id,
    email: data.email,
    name: data.name,
    isAccountAdmin: Boolean(data.is_account_admin),
    accountRole: data.account_role ?? "sub_account"
  };
}
