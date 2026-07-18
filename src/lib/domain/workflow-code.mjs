/**
 * @file 한글 책임: `workflow code` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
import { randomUUID } from "node:crypto";

/** 최초 문의부터 정산까지 모든 업무 단계에서 공유하는 추적 코드를 생성합니다. */
export function makeWorkflowCode({ countryCode, agencyName, submittedAt = new Date() }) {
  const country = normalizeSegment(countryCode, 3, "XX");
  const agency = normalizeSegment(agencyName, 10, "AGENCY");
  const date = submittedAt.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `${country}-${agency}-${date}-${suffix}`;
}

/** 공통 workflow code는 유지하면서 버전이 필요한 문서의 표시 번호만 생성합니다. */
export function makeVersionedDocumentNo(workflowCode, documentType, versionNo) {
  return `${workflowCode}-${documentType}-V${String(versionNo).padStart(2, "0")}`;
}

function normalizeSegment(value, maxLength, fallback) {
  return String(value ?? "").trim().replace(/[^a-z0-9]/gi, "").slice(0, maxLength).toUpperCase() || fallback;
}
