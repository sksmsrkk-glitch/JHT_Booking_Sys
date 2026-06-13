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
