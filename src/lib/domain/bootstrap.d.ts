/**
 * @file 한글 책임: `bootstrap` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
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
