/**
 * @file 한글 책임: `account recovery` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 전화번호 표기 방식이 달라도 동일한 번호로 비교할 수 있도록 숫자만 남깁니다. */
export function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/** 회사명과 담당자명 비교 시 대소문자와 연속 공백 차이를 제거합니다. */
export function normalizeIdentityText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

/** 계정 주소를 직접 노출하지 않고 본인만 식별할 수 있는 수준으로 가립니다. */
export function maskEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return "";
  const [local, domain] = email.split("@");
  const domainParts = domain.split(".");
  const suffix = domainParts.length > 1 ? `.${domainParts.pop()}` : "";
  const domainName = domainParts.join(".");
  const maskedLocal = `${local.slice(0, 1)}${"*".repeat(Math.max(3, local.length - 1))}`;
  const maskedDomain = `${domainName.slice(0, 1)}${"*".repeat(Math.max(3, domainName.length - 1))}`;
  return `${maskedLocal}@${maskedDomain}${suffix}`;
}

/** 새 비밀번호는 길이와 네 가지 문자 종류를 모두 만족해야 합니다. */
export function validateRecoveryPassword(value) {
  const password = String(value ?? "");
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/\d/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  return "";
}
