import { cookies } from "next/headers";
import type { Route } from "next";
import Link from "next/link";
import { normalizeLocale } from "@/lib/i18n";

const partnerTasks = [
  {
    href: "/agency/inquiries/new" as Route,
    title: { en: "Create New Inquiry", ko: "신규 견적 문의" },
    description: {
      en: "Submit tour title, pax, nights, travel period, flights, routing, meals, and special requests.",
      ko: "투어명, 인원, 박수, 기간, 항공, 일정, 식사, 특이사항을 입력합니다."
    },
    meta: { en: "Start here", ko: "시작 지점" }
  },
  {
    href: "/agency/quote-cases" as Route,
    title: { en: "Review Quotes", ko: "견적 확인" },
    description: {
      en: "Open customer-safe quote versions, itinerary descriptions, public totals, and request revisions.",
      ko: "파트너 공개 견적서, 일정 설명, 공개 금액, 재견적 요청을 확인합니다."
    },
    meta: { en: "Cost details hidden", ko: "원가 비공개" }
  },
  {
    href: "/agency/workflows" as Route,
    title: { en: "Communication", ko: "소통 원장" },
    description: {
      en: "Continue all quote changes, booking questions, cancellation requests, and JHT replies by workflow code.",
      ko: "투어 코드 기준으로 변경 요청, 예약 문의, 취소 요청, JHT 회신을 이어갑니다."
    },
    meta: { en: "Code-based history", ko: "코드별 히스토리" }
  },
  {
    href: "/agency/reservations" as Route,
    title: { en: "Reservations", ko: "예약 관리" },
    description: {
      en: "Track confirmed groups, rooming list revisions, reservation status, and partner-visible updates.",
      ko: "확정 단체, 룸리스트 수정, 예약 상태, 파트너 공개 업데이트를 확인합니다."
    },
    meta: { en: "After confirmation", ko: "확정 이후" }
  },
  {
    href: "/agency/invoices" as Route,
    title: { en: "Invoices", ko: "인보이스" },
    description: {
      en: "Check issued invoice versions, payment summaries, deposit status, and receivable follow-up.",
      ko: "발행 인보이스, 결제 요약, 디포짓 상태, 미수 follow-up을 확인합니다."
    },
    meta: { en: "Finance safe view", ko: "정산 공개 화면" }
  }
];

const processSteps = [
  { en: "Inquiry", ko: "문의" },
  { en: "Quote", ko: "견적" },
  { en: "Revision", ko: "수정" },
  { en: "Confirmation", ko: "확정" },
  { en: "Reservation", ko: "예약" },
  { en: "Invoice", ko: "인보이스" }
];

export default async function AgencyPage() {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("jht_locale")?.value);
  const isKorean = locale === "ko";

  return (
    <div className="partner-portal-shell">
      <section className="partner-portal-header">
        <div>
          <p className="eyebrow">{isKorean ? "해외 파트너 포털" : "Overseas Agency Portal"}</p>
          <h1>{isKorean ? "파트너 업무 대시보드" : "Partner Work Dashboard"}</h1>
          <p>
            {isKorean
              ? "신규 문의부터 견적, 변경 요청, 예약, 룸리스트, 인보이스까지 하나의 투어 코드로 이어서 관리하는 파트너 전용 화면입니다."
              : "A partner-only workspace for inquiries, quotes, revision requests, reservations, rooming lists, and invoices under one tour workflow code."}
          </p>
        </div>
        <div className="partner-access-panel">
          <span>{isKorean ? "파트너 계정" : "Partner Account"}</span>
          <strong>{isKorean ? "승인 후 로그인 가능" : "Approval Required"}</strong>
          <p>
            {isKorean
              ? "신규 파트너사는 가입 신청 후 JHT 내부 승인 절차를 거쳐 mother ID가 활성화됩니다."
              : "New agencies submit an application first. JHT approval activates the mother account."}
          </p>
          <div className="partner-access-actions">
            <Link className="button-primary" href={"/agency/login" as Route}>
              {isKorean ? "파트너 로그인" : "Partner Log In"}
            </Link>
            <Link className="button-secondary" href={"/agency/signup" as Route}>
              {isKorean ? "가입 신청" : "Apply"}
            </Link>
          </div>
        </div>
      </section>

      <section className="partner-status-strip" aria-label={isKorean ? "파트너 업무 흐름" : "Partner workflow"}>
        {processSteps.map((step, index) => (
          <div className="partner-status-item" key={step.en}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{isKorean ? step.ko : step.en}</strong>
          </div>
        ))}
      </section>

      <section className="partner-task-grid" aria-label={isKorean ? "파트너 업무 메뉴" : "Partner task menu"}>
        {partnerTasks.map((task) => (
          <Link className="partner-task-card" href={task.href} key={task.href}>
            <div>
              <span>{isKorean ? task.meta.ko : task.meta.en}</span>
              <h2>{isKorean ? task.title.ko : task.title.en}</h2>
            </div>
            <p>{isKorean ? task.description.ko : task.description.en}</p>
          </Link>
        ))}
      </section>

      <section className="notice">
        <h2>{isKorean ? "파트너 공개 범위" : "Customer-safe boundary"}</h2>
        <p>
          {isKorean
            ? "이 포털은 파트너 공개용 견적, 예약, 소통, 인보이스 정보만 보여줍니다. 국내 공급사 원가, 마진, 내부 업무, 정산 원장은 내부 관리자 화면에서만 관리합니다."
            : "This portal only exposes partner-safe quotes, reservations, communication, and invoice information. Domestic supplier costs, margins, internal tasks, and settlement ledgers remain internal-only."}
        </p>
      </section>
    </div>
  );
}
