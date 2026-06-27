export const MANAGEABLE_INTERNAL_ROLES: string[];

export type InternalProfileInput = {
  authUserId: string;
  email: string;
  displayName?: string | null;
  companyId?: string | null;
};

export type InternalProfileRow = {
  id: string;
  email: string;
  display_name: string;
  default_company_id: string | null;
  status: "active";
};

export function buildInternalProfileRow(input: InternalProfileInput): InternalProfileRow;
export function normalizeRoles(roles: unknown[]): string[];
export function buildInternalUserRoleRows(input: { userId: string; roles: unknown[] }): Array<{
  user_id: string;
  role: string;
}>;
