"use client";

import { useEffect } from "react";

const englishCalendarLocale = "en-US";
const calendarInputSelector = [
  'input[type="date"]',
  'input[type="datetime-local"]',
  'input[type="month"]',
  'input[type="week"]',
  'input[type="time"]'
].join(",");

/*
 * 파트너사는 해외 업체가 기본 사용자이므로 native date/month/time picker는 항상 영문 기준으로 고정합니다.
 * 브라우저 캘린더 UI는 문서 언어를 따라갈 수 있어, 페이지가 KOR 모드여도 날짜 입력 요소에는 en-US를 직접 부여합니다.
 */
export function CalendarLocaleEnforcer() {
  useEffect(() => {
    applyEnglishCalendarLocale(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) {
            applyEnglishCalendarLocale(node);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

function applyEnglishCalendarLocale(root: ParentNode | Element) {
  const inputs: HTMLInputElement[] = [];

  if (root instanceof HTMLInputElement && root.matches(calendarInputSelector)) {
    inputs.push(root);
  }

  if ("querySelectorAll" in root) {
    inputs.push(...Array.from(root.querySelectorAll<HTMLInputElement>(calendarInputSelector)));
  }

  for (const input of inputs) {
    input.lang = englishCalendarLocale;
    input.setAttribute("lang", englishCalendarLocale);
    input.setAttribute("data-calendar-locale", englishCalendarLocale);
  }
}
