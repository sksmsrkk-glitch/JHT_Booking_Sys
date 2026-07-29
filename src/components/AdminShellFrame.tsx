/**
 * @file 한글 책임: 어드민 경로에서만 좌측 네비게이션이 붙은 2단 레이아웃으로 전환합니다.
 * 파트너 포털과 공개 화면은 기존 단일 컬럼 레이아웃을 그대로 유지합니다.
 */
"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminWorkspaceSidebar } from "@/components/AdminWorkspaceSidebar";
import type { Locale } from "@/lib/i18n";

export function AdminShellFrame({ children, locale }: { children: ReactNode; locale: Locale }) {
  const pathname = usePathname();
  const isAdminSurface = pathname === "/admin" || pathname.startsWith("/admin/");

  if (!isAdminSurface) {
    return <main className="main">{children}</main>;
  }

  return (
    <div className="admin-workspace">
      <AdminWorkspaceSidebar locale={locale} />
      <main className="main admin-workspace-main">{children}</main>
    </div>
  );
}
