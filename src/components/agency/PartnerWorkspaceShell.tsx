"use client";

import type { ReactNode } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type PartnerWorkspaceShellProps = {
  children: ReactNode;
};

type PartnerNavItem = {
  href: Route;
  label: string;
  helper: string;
};

const partnerNavSections: Array<{ title: string; items: PartnerNavItem[] }> = [
  {
    title: "Workspace",
    items: [
      { href: "/agency" as Route, label: "Dashboard", helper: "Portal home" },
      { href: "/agency/quote-cases" as Route, label: "Quotes", helper: "Public quote versions" },
      { href: "/agency/reservations" as Route, label: "Reservations", helper: "Confirmed groups" },
      { href: "/agency/workflows" as Route, label: "Communication", helper: "Code-based history" }
    ]
  },
  {
    title: "Create",
    items: [
      { href: "/agency/inquiries/new" as Route, label: "New Inquiry", helper: "Request a new quote" },
      { href: "/agency/inquiries" as Route, label: "Inquiry Ledger", helper: "Submitted requests" }
    ]
  },
  {
    title: "Finance",
    items: [{ href: "/agency/invoices" as Route, label: "Invoices", helper: "Issued invoices" }]
  },
  {
    title: "Account",
    items: [{ href: "/agency/signup" as Route, label: "Partner Sign-up", helper: "Apply for access" }]
  }
];

/*
 * 파트너 포털은 내부 관리자 화면과 다른 사용자가 쓰는 영역입니다.
 * Notion처럼 좌측 페이지 트리와 중앙 데이터베이스 화면을 분리해
 * 파트너가 견적, 예약, 인보이스, 소통 내역을 같은 workflow code 기준으로 찾게 합니다.
 */
export function PartnerWorkspaceShell({ children }: PartnerWorkspaceShellProps) {
  const pathname = usePathname();

  return (
    <div className="partner-workspace">
      <aside className="partner-workspace-sidebar" aria-label="Partner portal workspace navigation">
        <div className="partner-workspace-brand">
          <span>JHT Partner</span>
          <strong>Travel Workspace</strong>
          <p>Inquiry, quote, reservation, invoice, and messages under one workflow code.</p>
        </div>

        <nav className="partner-workspace-nav">
          {partnerNavSections.map((section) => (
            <section className="partner-workspace-nav-section" key={section.title}>
              <h2>{section.title}</h2>
              {section.items.map((item) => {
                const isActive = item.href === "/agency" ? pathname === item.href : pathname.startsWith(item.href);

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={isActive ? "partner-workspace-link active" : "partner-workspace-link"}
                    href={item.href}
                    key={item.href}
                  >
                    <span>{item.label}</span>
                    <small>{item.helper}</small>
                  </Link>
                );
              })}
            </section>
          ))}
        </nav>

        <div className="partner-workspace-note">
          <span>Workflow Code</span>
          <p>One code connects inquiry, quote, reservation, confirmation, invoice, finance, and messages.</p>
        </div>
      </aside>

      <section className="partner-workspace-main">{children}</section>
    </div>
  );
}
