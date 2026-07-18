/**
 * @file 한글 책임: `company` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export function buildCompanyCreateRow({ code, nameKo, nameEn }) {
  return {
    code: requireCompanyCode(code),
    name_ko: requireText(nameKo, "nameKo"),
    name_en: requireText(nameEn, "nameEn"),
    status: "active"
  };
}

function requireCompanyCode(value) {
  const normalized = requireText(value, "code").toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(normalized)) {
    throw new Error("code must be 2-20 uppercase letters, numbers, underscores, or hyphens");
  }
  return normalized;
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}
