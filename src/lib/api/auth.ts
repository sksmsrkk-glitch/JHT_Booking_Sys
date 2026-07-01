import { HttpError } from "./http";

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
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new HttpError(401, "Authentication is required");
  }
  return data.user;
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
    .select("id, agency_account_id, email, name")
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
    name: data.name
  };
}
