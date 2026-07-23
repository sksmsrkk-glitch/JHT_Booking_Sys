/**
 * @file 한글 책임: 해외 파트너 화면에서 브라우저 기본 날짜 picker의 로캘 편차를 없앤 날짜 입력 컴포넌트입니다.
 * 서버와 클라이언트가 동일한 `type="text"` 마크업을 렌더해 하이드레이션 불일치를 원천 차단하고,
 * 실제 영문 캘린더 팝오버는 CalendarLocaleEnforcer가 data 마커를 보고 부착합니다.
 */
"use client";

import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

type LocaleDateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** 날짜(YYYY-MM-DD) 또는 월(YYYY-MM) 입력 모드. 기본값 date. */
  mode?: "date" | "month";
};

/*
 * 예전 구현은 마운트 후 전역 MutationObserver로 모든 `input[type="date"]`를 `type="text"`로
 * 바꿔치기했는데, 서버가 그린 `type="date"`와 클라이언트 DOM이 어긋나 React 하이드레이션
 * 불일치가 매 화면에서 발생했습니다. 이 컴포넌트는 처음부터 text로 렌더해 그 불일치를 없앱니다.
 * form 제출 값 형식(YYYY-MM-DD / YYYY-MM)은 그대로 유지합니다.
 */
export const LocaleDateInput = forwardRef<HTMLInputElement, LocaleDateInputProps>(
  function LocaleDateInput({ mode = "date", className, placeholder, inputMode, ...rest }, ref) {
    const isMonth = mode === "month";
    const classes = ["jht-english-calendar-input", className].filter(Boolean).join(" ");
    return (
      <input
        {...rest}
        ref={ref}
        type="text"
        data-jht-calendar={mode}
        lang="en-US"
        autoComplete="off"
        inputMode={inputMode ?? "numeric"}
        pattern={isMonth ? "\\d{4}-\\d{2}" : "\\d{4}-\\d{2}-\\d{2}"}
        placeholder={placeholder ?? (isMonth ? "YYYY-MM" : "YYYY-MM-DD")}
        className={classes}
      />
    );
  }
);
