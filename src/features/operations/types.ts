/**
 * @file 한글 책임: `operations` 기능에서 화면, API 및 조회 계층이 공유하는 타입 계약을 정의합니다.
 * DB의 snake_case 표현과 UI 모델의 차이를 명시적으로 분리해 필드 누락이나 잘못된 상태값이 컴파일 단계에서 드러나게 합니다.
 */
export type OperationTaskListItem = {
  id: string;
  reservationId: string;
  reservationCode: string | null;
  agencyName: string | null;
  tourName: string | null;
  team: string;
  taskType: string;
  title: string;
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  domesticSupplierId: string | null;
  domesticSupplierName: string | null;
  reminderCount: number;
  createdAt: string;
};

export type OperationTaskFilters = {
  team?: string;
  status?: string;
  q?: string;
};
