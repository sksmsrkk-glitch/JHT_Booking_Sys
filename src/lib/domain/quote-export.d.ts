/**
 * @file 한글 책임: `quote export` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
export const QUOTE_EXPORT_ACTIVE_STATUSES: string[];
export const QUOTE_EXPORT_BLOCKED_VERSION_STATUSES: string[];

export function buildQuoteExportRequest(input: {
  quoteVersionId: string;
  versionStatus: string;
  publicTotalAmount: number;
  storagePath: string;
}): {
  quote_version_id: string;
  export_type: "xlsx";
  storage_path: string;
  status: "queued";
};

export function buildQuoteExportRetryUpdate(exportRow: {
  id?: string | null;
  status?: string | null;
  storage_path?: string | null;
}): {
  status: "queued";
  error_message: null;
};

export function buildQuoteExportSnapshotSummary(input: {
  quoteCase?: Record<string, any> | null;
  version?: Record<string, any> | null;
}): {
  caseCode: string | null;
  tourName: string | null;
  versionNo: number | null;
  status: string | null;
  currency: string | null;
  publicTotalAmount: number;
  itineraryDayCount: number;
  routeSegmentCount: number;
  itemCount: number;
};
