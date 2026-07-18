/**
 * @file 한글 책임: `internal-users` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import type { InternalUserListItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function listInternalUsers(supabase: SupabaseClientLike): Promise<InternalUserListItem[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, status, default_company_id, created_at, updated_at, user_roles(role)")
    .order("created_at", { ascending: false })
    .limit(150);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapInternalUserListItem);
}

function mapInternalUserListItem(row: any): InternalUserListItem {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? null,
    status: row.status,
    defaultCompanyId: row.default_company_id ?? null,
    roles: (row.user_roles ?? []).map((role: any) => role.role).sort(),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
