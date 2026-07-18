/**
 * @file 한글 책임: `workflow code` 도메인 모듈의 공개 타입과 함수 시그니처를 TypeScript에 제공합니다.
 * 실행 구현과 선언이 어긋나지 않도록 업무 상태, 입력 및 반환값의 허용 범위를 명시합니다.
 */
export function makeWorkflowCode(input: {
  countryCode: string;
  agencyName: string;
  submittedAt?: Date;
}): string;

export function makeVersionedDocumentNo(
  workflowCode: string,
  documentType: "INV" | "CNF",
  versionNo: number
): string;
