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
