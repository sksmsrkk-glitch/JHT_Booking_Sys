/**
 * @file 한글 책임: `audit` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type AuditLogListItem = {
  id: string;
  actorProfileId: string | null;
  actorEmail: string | null;
  action: string;
  entityTable: string;
  entityId: string | null;
  riskLevel: string;
  hasBeforeData: boolean;
  hasAfterData: boolean;
  hasApprovalData: boolean;
  requestId: string | null;
  createdAt: string;
};

export type AuditLogFilters = {
  riskLevel?: string;
  entityTable?: string;
  action?: string;
};

export type ApiLogListItem = {
  id: string;
  source: string;
  endpoint: string | null;
  method: string | null;
  statusCode: number | null;
  idempotencyKey: string | null;
  hasRequestPayload: boolean;
  hasResponsePayload: boolean;
  createdAt: string;
};

export type ApiLogFilters = {
  source?: string;
  endpoint?: string;
  status?: string;
};
