import { HttpError } from "./http";

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
  const internalUser = await requireInternalUser(supabase);
  if (!internalUser.roles.some((role: string) => role === "admin" || role === "finance")) {
    throw new HttpError(403, "Finance role is required");
  }
  return internalUser;
}

export async function requireAgencyUser(supabase: any) {
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
