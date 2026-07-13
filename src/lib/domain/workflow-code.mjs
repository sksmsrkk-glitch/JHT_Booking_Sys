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
