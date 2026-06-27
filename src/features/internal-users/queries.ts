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
