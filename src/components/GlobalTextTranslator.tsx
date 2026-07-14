"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

const textMap: Record<string, string> = {
  "Back to Admin": "관리자 홈",
  "Back to Quotes": "견적 목록",
  "Back to Reservations": "예약 목록",
  "Search Costs": "원가 검색",
  "Open Quotes": "견적 열기",
  "Open Tasks": "업무 열기",
  "Create Quote Case": "견적 건 생성",
  "Load Excel Sample": "엑셀 샘플 불러오기",
  "Add Row": "행 추가",
  "Add Day": "일정 추가",
  "Add Item": "항목 추가",
  "Add Hotel": "호텔 추가",
  "Add Vehicle / Transport": "차량/교통 추가",
  "Add Meals": "식사 추가",
  "Add Attractions": "관광지 추가",
  "Add Guide": "가이드 추가",
  "Add Other": "기타 추가",
  "Remove": "삭제",
  "Search": "검색",
  "Filter": "필터",
  "Save": "저장",
  "Submit": "제출",
  "Upload": "업로드",
  "Download": "다운로드",
  "Export": "내보내기",
  "Import": "가져오기",
  "Export Excel": "엑셀 출력",
  "Import Excel": "엑셀 입력",
  "Download Template": "템플릿 다운로드",
  "Create": "생성",
  "Update": "수정",
  "Cancel": "취소",
  "Approve": "승인",
  "Send": "발송",
  "Retry": "재시도",
  "Recalculate": "재계산",
  "Sign In": "로그인",
  "Sign Out": "로그아웃",
  "Log In": "로그인",
  "Log Out": "로그아웃",
  "Internal Admin": "내부 관리자",
  "Domestic Suppliers": "국내 공급사",
  "Quote Cases": "견적 관리",
  "Quotes": "견적",
  "Reservations": "예약",
  "Overseas Agency Portal": "해외 파트너 포털",
  "Overseas Agencies": "해외 파트너사",
  "Companies": "회사 관리",
  "Cost Search": "원가 검색",
  "Exchange Rates": "환율 관리",
  "Create Exchange Rate": "환율 등록",
  "No exchange rates found": "등록된 환율 없음",
  "Usage Rule": "사용 규칙",
  "Save Exchange Rate": "환율 저장",
  "Rate to KRW": "원화 환율",
  "Base Currency": "기준 통화",
  "Quote Currency": "상대 통화",
  "Effective Date": "적용일",
  "Source": "출처",
  "Operation Tasks": "오퍼레이션 업무",
  "Supplier Messages": "공급사 메시지",
  "Finance": "회계/정산",
  "Invoices": "인보이스",
  "Settlements": "정산",
  "Audit Log": "감사 로그",
  "API Logs": "API 로그",
  "Internal Users": "내부 사용자",
  "Support Tools": "지원 도구",
  "Main Workflow": "핵심 업무 흐름",
  "Operations Dashboard": "운영 대시보드",
  "Dynamic Board": "동적 보드",
  "Country": "국가",
  "Partner": "파트너사",
  "Period": "기간",
  "Status": "상태",
  "Overview": "전체",
  "Overview Table": "전체 보기",
  "Country View": "국가별 보기",
  "Partner View": "파트너사별 보기",
  "Period View": "기간별 보기",
  "Status View": "상태별 보기",
  "All countries": "전체 국가",
  "All partners": "전체 파트너사",
  "All statuses": "전체 상태",
  "From": "시작일",
  "To": "종료일",
  "Name": "이름",
  "Role": "역할",
  "Email": "이메일",
  "Phone": "전화",
  "Notes": "메모",
  "Company": "회사",
  "Overseas Agency": "해외 파트너사",
  "Tour Name": "투어명",
  "Currency": "통화",
  "Estimated Pax": "예상 인원",
  "Default Margin Rate": "기본 마진율",
  "Start Date": "시작일",
  "End Date": "종료일",
  "Exchange Rate to KRW": "원화 환율",
  "Global FX to KRW": "공통 원화 환율",
  "Apply Common FX": "공통 환율 적용",
  "Agency Summary Notes": "파트너 공개 요약",
  "Terms and Conditions": "약관 및 조건",
  "Quote Items": "견적 항목",
  "Itinerary Days": "일정표",
  "Day": "일차",
  "Date": "날짜",
  "Weekday": "요일",
  "City / Area": "도시/지역",
  "Title": "제목",
  "Program Description": "일정 설명",
  "Breakfast": "조식",
  "Lunch": "중식",
  "Dinner": "석식",
  "Hotel": "호텔",
  "Category": "카테고리",
  "Supplier": "공급사",
  "Unit Cost": "단가",
  "Formula": "계산식",
  "Qty": "수량",
  "Pax": "인원",
  "Margin": "마진",
  "Sell": "판매가",
  "Editable": "수정 가능",
  "Partner quote inquiries": "파트너 견적 문의",
  "Confirmed groups": "확정 단체",
  "Cancelled groups": "취소 단체",
  "All inquiries": "전체 문의",
  "Total pax": "총 인원",
  "Settlement done": "정산 완료",
  "Receivable groups": "미수 단체",
  "Receivable amount": "미수 금액",
  "Quote inquiries": "견적 문의",
  "Confirmed": "확정",
  "Cancelled": "취소",
  "Receivable": "미수금",
  "Top Countries": "주요 국가",
  "Top Partners": "주요 파트너사",
  "By Status": "상태별"
};

const placeholderMap: Record<string, string> = {
  "Search": "검색",
  "Case code, tour, share id": "견적 코드, 투어명, 공유 ID",
  "Code, group, agency": "예약 코드, 단체명, 여행사",
  "Supplier, region, keyword": "공급사, 지역, 키워드",
  "Seoul incentive tour": "서울 인센티브 투어",
  "Customer-visible short summary": "파트너에게 보이는 간단 요약",
  "Payment terms, cancellation policy, validity": "결제 조건, 취소 규정, 유효기간",
  "hotel, bibimbap, bus...": "호텔, 비빔밥, 버스...",
  "Item name": "항목명",
  "Supplier": "공급사",
  "Local meal": "현지식",
  "Dinner": "석식",
  "Hotel name": "호텔명"
};

export function GlobalTextTranslator({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const isAgencySurface = pathname === "/agency" || pathname.startsWith("/agency/");

  useEffect(() => {
    // 파트너 포털은 영어 전용이므로 관리자 KOR 설정의 전역 DOM 번역을 적용하지 않습니다.
    if (locale !== "ko" || isAgencySurface) return;

    const translate = () => {
      translateTextNodes(document.body);
      translateAttributes(document.body);
    };

    translate();
    const observer = new MutationObserver(translate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isAgencySurface, locale]);

  return null;
}

function translateTextNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) continue;
    nodes.push(node);
  }

  for (const node of nodes) {
    const original = node.nodeValue ?? "";
    const trimmed = original.trim();
    const translated = textMap[trimmed];
    if (!translated || trimmed === translated) continue;
    node.nodeValue = original.replace(trimmed, translated);
  }
}

function translateAttributes(root: HTMLElement) {
  const elements = root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], option");
  for (const element of elements) {
    if (element instanceof HTMLOptionElement) {
      const translated = textMap[element.textContent?.trim() ?? ""];
      if (translated) element.textContent = translated;
    }

    const placeholder = element.getAttribute("placeholder");
    if (placeholder && placeholderMap[placeholder]) {
      element.setAttribute("placeholder", placeholderMap[placeholder]);
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && textMap[ariaLabel]) {
      element.setAttribute("aria-label", textMap[ariaLabel]);
    }
  }
}
