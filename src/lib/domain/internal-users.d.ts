/**
 * @file 한글 책임: `internal users` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
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
