/**
 * @file 한글 책임: `gmail match` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
export function scoreGmailMatch({ message, quoteCase, agency }) {
  let score = 0;
  const reasons = [];
  const subject = normalize(message.subject);
  const body = normalize(message.body ?? "");
  const agencyDomain = agency?.emailDomain ? normalize(agency.emailDomain) : "";

  if (quoteCase?.caseCode && subject.includes(normalize(quoteCase.caseCode))) {
    score += 0.55;
    reasons.push("case_code_subject");
  }

  if (quoteCase?.gmailThreadId && message.threadId === quoteCase.gmailThreadId) {
    score += 0.3;
    reasons.push("thread_id_exact");
  }

  if (agencyDomain && normalize(message.from ?? "").includes(agencyDomain)) {
    score += 0.1;
    reasons.push("agency_email_domain");
  }

  if (quoteCase?.tourName && (body.includes(normalize(quoteCase.tourName)) || subject.includes(normalize(quoteCase.tourName)))) {
    score += 0.05;
    reasons.push("tour_name_reference");
  }

  return {
    score: Math.min(1, Number(score.toFixed(2))),
    requiresManualReview: score < 0.7,
    reasons
  };
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}
