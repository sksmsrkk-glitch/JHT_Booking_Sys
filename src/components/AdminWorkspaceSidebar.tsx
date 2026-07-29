/**
 * @file 한글 책임: 어드민 좌측 워크스페이스 네비게이션의 표시 상태와 현재 위치 표시를 담당합니다.
 * 화면 이동만 담당하며 권한 검사를 대체하지 않습니다. 실제 접근 통제는 각 페이지·API의 역할 검사가 수행합니다.
 */
"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";

type AdminNavItem = {
  href: Route;
  labelKo: string;
  labelEn: string;
  helperKo: string;
  helperEn: string;
};

type AdminNavSection = {
  titleKo: string;
  titleEn: string;
  items: AdminNavItem[];
};

/*
 * 예전 상단바는 4개만 노출하고 9개를 "더보기" 드롭다운에 숨겨, 매일 쓰는 공급사·확정서·가이드 지출이
 * 두 번 클릭해야 닿는 위치에 있었습니다. 업무 흐름(업무 → 영업 → 운영 → 재무 → 시스템) 순서대로
 * 전부 펼쳐 한눈에 보이게 합니다.
 */
const adminNavSections: AdminNavSection[] = [
  {
    titleKo: "업무",
    titleEn: "Work",
    items: [
      { href: "/admin" as Route, labelKo: "오늘 할 일", labelEn: "Today", helperKo: "대시보드", helperEn: "Dashboard" },
      {
        href: "/admin/workflows" as Route,
        labelKo: "단체 상황판",
        labelEn: "Groups",
        helperKo: "투어 코드별 진행",
        helperEn: "Progress by tour code"
      },
      {
        href: "/admin/operations/tasks" as Route,
        labelKo: "운영 업무",
        labelEn: "Operation Tasks",
        helperKo: "팀별 업무 보드",
        helperEn: "Team task board"
      }
    ]
  },
  {
    titleKo: "영업",
    titleEn: "Sales",
    items: [
      {
        href: "/admin/quote-cases" as Route,
        labelKo: "견적",
        labelEn: "Quotes",
        helperKo: "견적 케이스·버전",
        helperEn: "Cases and versions"
      },
      {
        href: "/admin/agencies" as Route,
        labelKo: "파트너사",
        labelEn: "Partners",
        helperKo: "해외 여행사 계정",
        helperEn: "Overseas agencies"
      }
    ]
  },
  {
    titleKo: "운영",
    titleEn: "Operations",
    items: [
      {
        href: "/admin/reservations" as Route,
        labelKo: "예약",
        labelEn: "Reservations",
        helperKo: "확정 단체",
        helperEn: "Confirmed groups"
      },
      {
        href: "/admin/confirmations" as Route,
        labelKo: "확정서",
        labelEn: "Confirmations",
        helperKo: "최종 운영 내역",
        helperEn: "Final operation snapshot"
      },
      {
        href: "/admin/domestic-suppliers" as Route,
        labelKo: "공급사",
        labelEn: "Suppliers",
        helperKo: "국내 원가 마스터",
        helperEn: "Domestic cost master"
      },
      {
        href: "/admin/supplier-messages" as Route,
        labelKo: "공급사 메시지",
        labelEn: "Supplier Messages",
        helperKo: "승인 후 발송",
        helperEn: "Approve then send"
      }
    ]
  },
  {
    titleKo: "재무",
    titleEn: "Finance",
    items: [
      {
        href: "/admin/finance/invoices" as Route,
        labelKo: "인보이스",
        labelEn: "Invoices",
        helperKo: "발행·입금",
        helperEn: "Issue and payments"
      },
      {
        href: "/admin/finance/settlements" as Route,
        labelKo: "정산",
        labelEn: "Settlements",
        helperKo: "최종 손익",
        helperEn: "Final profit"
      },
      {
        href: "/admin/guide-expenses" as Route,
        labelKo: "가이드 지출",
        labelEn: "Guide Expenses",
        helperKo: "실지출 정산",
        helperEn: "Actual tour costs"
      },
      {
        href: "/admin/exchange-rates" as Route,
        labelKo: "환율",
        labelEn: "Exchange Rates",
        helperKo: "공통 환율 마스터",
        helperEn: "Shared FX master"
      }
    ]
  },
  {
    titleKo: "시스템",
    titleEn: "System",
    items: [
      {
        href: "/admin/users" as Route,
        labelKo: "사용자",
        labelEn: "Users",
        helperKo: "내부 역할 관리",
        helperEn: "Internal roles"
      },
      {
        href: "/admin/account-recovery" as Route,
        labelKo: "계정 복구",
        labelEn: "Account Recovery",
        helperKo: "파트너 접근 복구",
        helperEn: "Partner access"
      },
      {
        href: "/admin/automation/failed-jobs" as Route,
        labelKo: "자동화",
        labelEn: "Automation",
        helperKo: "실패 작업·Gmail 검토",
        helperEn: "Failed jobs and Gmail"
      },
      {
        href: "/admin/audit" as Route,
        labelKo: "감사 로그",
        labelEn: "Audit",
        helperKo: "고위험 작업 이력",
        helperEn: "High-risk trail"
      }
    ]
  }
];

function isItemActive(pathname: string, href: string) {
  // "/admin"은 정확히 일치할 때만 활성화합니다. 하위 경로까지 잡으면 항상 활성으로 보입니다.
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminWorkspaceSidebar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const isKo = locale === "ko";

  return (
    <aside className="admin-workspace-sidebar" aria-label={isKo ? "관리자 네비게이션" : "Admin navigation"}>
      <nav className="admin-workspace-nav">
        {adminNavSections.map((section) => (
          <section className="admin-workspace-nav-section" key={section.titleEn}>
            <h2>{isKo ? section.titleKo : section.titleEn}</h2>
            {section.items.map((item) => {
              const isActive = isItemActive(pathname, item.href);
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={isActive ? "admin-workspace-link active" : "admin-workspace-link"}
                  href={item.href}
                  key={item.href}
                >
                  <span>{isKo ? item.labelKo : item.labelEn}</span>
                  <small>{isKo ? item.helperKo : item.helperEn}</small>
                </Link>
              );
            })}
          </section>
        ))}
      </nav>
    </aside>
  );
}
