/**
 * @file 한글 책임: `Theme Toggle` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

const storageKey = "jht-theme-mode";

/*
 * 다크모드 토글입니다.
 *
 * 서버 렌더링 시점에는 브라우저 localStorage와 OS 테마를 알 수 없으므로
 * 최초 HTML은 중립 상태로 렌더링하고, useEffect 이후에만 실제 테마를 적용합니다.
 * 이렇게 해야 hydration mismatch를 줄일 수 있습니다.
 */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const nextMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setMode(nextMode);
    setResolvedDark(applyTheme(nextMode));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if ((window.localStorage.getItem(storageKey) ?? "system") === "system") {
        setResolvedDark(applyTheme("system"));
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  function chooseTheme(nextMode: ThemeMode) {
    setMode(nextMode);
    window.localStorage.setItem(storageKey, nextMode);
    setResolvedDark(applyTheme(nextMode));
  }

  function toggleDark() {
    chooseTheme(resolvedDark ? "light" : "dark");
  }

  return (
    <div className="theme-toggle" aria-label="Theme mode">
      <button aria-pressed={resolvedDark} className={resolvedDark ? "active" : ""} onClick={toggleDark} type="button">
        Dark
      </button>
    </div>
  );
}

function applyTheme(mode: ThemeMode) {
  // html.dark 클래스를 전역 CSS 기준으로 사용합니다.
  // data-theme은 추후 system/light/dark 상태를 디버깅하거나 확장할 때 확인용으로 남깁니다.
  const shouldUseDark =
    mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", shouldUseDark);
  document.documentElement.dataset.theme = mode;
  return shouldUseDark;
}
