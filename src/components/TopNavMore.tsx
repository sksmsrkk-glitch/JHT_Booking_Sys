/**
 * @file 한글 책임: `Top Nav More` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import type { Route } from "next";
import Link from "next/link";
import { useId } from "react";

type NavItem = {
  href: Route | string;
  label: string;
};

/*
 * 상단 More 메뉴입니다.
 *
 * React state 대신 checkbox + label/backdrop 방식으로 구현해,
 * 메뉴 밖 영역을 클릭하면 자동으로 닫히게 했습니다. 메뉴 항목이 늘어나도
 * 상단 네비게이션은 Dashboard / Quotes / Reservations / Finance 중심으로 단순하게 유지합니다.
 */
export function TopNavMore({ label, items }: { label: string; items: NavItem[] }) {
  const menuId = useId();

  return (
    <div className="nav-more">
      <input aria-hidden="true" className="nav-more-toggle" id={menuId} type="checkbox" />
      <label className="nav-more-trigger" htmlFor={menuId}>
        {label}
      </label>
      <label aria-label="Close menu" className="nav-more-backdrop" htmlFor={menuId} />
      <div className="nav-more-menu" role="menu">
        {items.map((item) => (
          <Link href={item.href as Route} key={`${item.href}-${item.label}`} role="menuitem">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
