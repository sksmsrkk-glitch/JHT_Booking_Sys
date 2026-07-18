/**
 * @file 한글 책임: `company` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
import type { CompanyListItem } from "./types";

type SupabaseClientLike = {
  from: (table: string) => any;
};

export async function listCompanies(
  supabase: SupabaseClientLike,
  options: { status?: string | null } = {}
): Promise<CompanyListItem[]> {
  let query = supabase
    .from("companies")
    .select("id, code, name_ko, name_en, status, created_at, updated_at")
    .order("code", { ascending: true });

  if (options.status !== "all") {
    query = query.eq("status", options.status ?? "active");
  }

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    code: row.code,
    nameKo: row.name_ko,
    nameEn: row.name_en,
    status: row.status,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  }));
}
