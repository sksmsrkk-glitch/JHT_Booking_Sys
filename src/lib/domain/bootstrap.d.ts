export type InitialAdminBootstrapInput = {
  authUserId: string;
  email: string;
  displayName?: string | null;
  companyId?: string | null;
};

export type InitialCompanyBootstrapInput = {
  code?: string | null;
  nameKo?: string | null;
  nameEn?: string | null;
};

export type InitialCompanyBootstrapRow = {
  code: string;
  name_ko: string;
  name_en: string;
  status: "active";
};

export type InitialAdminBootstrapRows = {
  profile: {
    id: string;
    email: string;
    display_name: string;
    default_company_id: string | null;
    status: "active";
  };
  roles: Array<{
    user_id: string;
    role: "admin" | "finance";
  }>;
};

export function buildInitialAdminBootstrapRows(input: InitialAdminBootstrapInput): InitialAdminBootstrapRows;
export function buildInitialCompanyBootstrapRow(input?: InitialCompanyBootstrapInput): InitialCompanyBootstrapRow;
export function assertBootstrapAllowed(input: { adminRoleCount: number }): true;
