/**
 * @file 한글 책임: `Calendar Locale Enforcer` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { useEffect } from "react";

// LocaleDateInput이 서버·클라이언트 동일하게 렌더한 text 입력을 data 마커로 찾습니다.
// 예전처럼 input[type="date"]를 런타임에 type="text"로 바꾸지 않으므로 하이드레이션 불일치가 없습니다.
const dateInputSelector = 'input[data-jht-calendar="date"]';
const monthInputSelector = 'input[data-jht-calendar="month"]';
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PickerMode = "date" | "month";

/*
 * 브라우저 기본 date/month picker는 Windows 또는 Chrome 언어 설정을 따라가므로
 * lang="en-US"만으로는 해외 파트너용 화면을 영문 캘린더로 고정할 수 없습니다.
 * 그래서 원래 form 값 형식은 유지하면서, 날짜/월 입력을 영문 커스텀 picker로 교체합니다.
 */
export function CalendarLocaleEnforcer() {
  useEffect(() => {
    let activeInput: HTMLInputElement | null = null;
    let activeMode: PickerMode = "date";
    let viewDate = new Date();
    const popover = document.createElement("div");

    popover.className = "jht-english-calendar";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", "English calendar picker");
    popover.hidden = true;
    document.body.appendChild(popover);

    const closePicker = () => {
      popover.hidden = true;
      activeInput = null;
    };

    const openPicker = (input: HTMLInputElement, mode: PickerMode) => {
      if (input.disabled || input.readOnly) return;
      activeInput = input;
      activeMode = mode;
      viewDate = resolveInitialViewDate(input.value, mode);
      renderPicker();
      popover.hidden = false;
      positionPicker();
    };

    const renderPicker = () => {
      if (!activeInput) return;
      const input = activeInput;

      if (activeMode === "month") {
        renderMonthPicker(popover, viewDate, (nextYear) => {
          viewDate = new Date(nextYear, viewDate.getMonth(), 1);
          renderPicker();
          positionPicker();
        }, (selectedMonth) => {
          setInputValue(input, `${viewDate.getFullYear()}-${pad2(selectedMonth + 1)}`);
          closePicker();
        });
        return;
      }

      renderDatePicker(popover, viewDate, input.value, (nextMonth) => {
        viewDate = new Date(viewDate.getFullYear(), nextMonth, 1);
        renderPicker();
        positionPicker();
      }, (selectedDate) => {
        setInputValue(input, formatIsoDate(selectedDate));
        closePicker();
      });
    };

    const positionPicker = () => {
      if (!activeInput) return;
      const rect = activeInput.getBoundingClientRect();
      const preferredWidth = activeMode === "month" ? 300 : 316;
      const width = Math.min(preferredWidth, Math.max(220, window.innerWidth - 24));
      const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
      popover.style.width = `${width}px`;
      const height = popover.getBoundingClientRect().height;
      const below = rect.bottom + 6;
      const above = rect.top - height - 6;
      const preferredTop = below + height <= window.innerHeight - 12 || above < 12 ? below : above;
      const top = Math.min(Math.max(12, preferredTop), Math.max(12, window.innerHeight - height - 12));
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    };

    const enhanceRoot = (root: ParentNode | Element) => {
      const dateInputs = collectInputs(root, dateInputSelector);
      const monthInputs = collectInputs(root, monthInputSelector);

      for (const input of dateInputs) enhancePickerInput(input, "date", openPicker);
      for (const input of monthInputs) enhancePickerInput(input, "month", openPicker);
    };

    enhanceRoot(document);

    // data 마커는 렌더 시점에 이미 존재하므로 attribute 감시는 필요 없고,
    // 조건부로 새로 나타나는 폼 입력을 잡기 위해 childList/subtree만 관찰합니다.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof Element) enhanceRoot(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (popover.hidden) return;
      if (popover.contains(target) || target === activeInput) return;
      closePicker();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePicker();
    };

    const handleViewportChange = () => {
      if (!popover.hidden) positionPicker();
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      popover.remove();
    };
  }, []);

  return null;
}

function collectInputs(root: ParentNode | Element, selector: string) {
  const inputs: HTMLInputElement[] = [];

  if (root instanceof HTMLInputElement && root.matches(selector)) {
    inputs.push(root);
  }

  if ("querySelectorAll" in root) {
    inputs.push(...Array.from(root.querySelectorAll<HTMLInputElement>(selector)));
  }

  return inputs;
}

// 바인딩 여부를 DOM 데이터 속성이 아니라 메모리 WeakSet으로 추적합니다.
// React가 소유한 input의 속성을 하이드레이션 이후에 바꾸면 불일치 경고가 나므로,
// 이 컴포넌트는 input의 어떤 속성도 변경하지 않고 이벤트 리스너만 부착합니다.
const boundInputs = new WeakSet<HTMLInputElement>();

function enhancePickerInput(
  input: HTMLInputElement,
  mode: PickerMode,
  openPicker: (input: HTMLInputElement, mode: PickerMode) => void
) {
  // 입력은 LocaleDateInput이 text + lang="en-US" + data 마커까지 서버·클라이언트 동일하게 렌더합니다.
  // 여기서는 속성을 건드리지 않고 리스너만 한 번 부착합니다.
  if (boundInputs.has(input)) return;
  boundInputs.add(input);

  input.addEventListener("focus", () => openPicker(input, mode));
  input.addEventListener("click", () => openPicker(input, mode));
}

function renderDatePicker(
  popover: HTMLDivElement,
  viewDate: Date,
  selectedValue: string,
  onMonthChange: (nextMonth: number) => void,
  onSelect: (selectedDate: Date) => void
) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const selectedIso = selectedValue;

  popover.replaceChildren();
  popover.appendChild(createPickerHeader(
    new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(viewDate),
    () => onMonthChange(month - 1),
    () => onMonthChange(month + 1)
  ));

  const weekdays = document.createElement("div");
  weekdays.className = "jht-calendar-weekdays";
  for (const weekday of weekdayNames) {
    const cell = document.createElement("span");
    cell.textContent = weekday;
    weekdays.appendChild(cell);
  }
  popover.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "jht-calendar-grid";

  for (let index = 0; index < firstDay; index += 1) {
    const spacer = document.createElement("span");
    spacer.className = "jht-calendar-spacer";
    grid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(day);
    button.setAttribute("aria-label", formatPickerAriaDate(date));
    if (formatIsoDate(date) === selectedIso) button.className = "selected";
    button.addEventListener("click", () => onSelect(date));
    grid.appendChild(button);
  }

  popover.appendChild(grid);
}

function renderMonthPicker(
  popover: HTMLDivElement,
  viewDate: Date,
  onYearChange: (nextYear: number) => void,
  onSelect: (selectedMonth: number) => void
) {
  const year = viewDate.getFullYear();

  popover.replaceChildren();
  popover.appendChild(createPickerHeader(String(year), () => onYearChange(year - 1), () => onYearChange(year + 1)));

  const grid = document.createElement("div");
  grid.className = "jht-calendar-month-grid";

  monthNames.forEach((monthName, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = monthName;
    button.setAttribute("aria-label", `${monthName} ${year}`);
    button.addEventListener("click", () => onSelect(index));
    grid.appendChild(button);
  });

  popover.appendChild(grid);
}

function createPickerHeader(title: string, onPrevious: () => void, onNext: () => void) {
  const header = document.createElement("div");
  header.className = "jht-calendar-header";

  const previous = document.createElement("button");
  previous.type = "button";
  previous.setAttribute("aria-label", "Previous");
  previous.textContent = "<";
  previous.addEventListener("click", onPrevious);

  const label = document.createElement("strong");
  label.textContent = title;

  const next = document.createElement("button");
  next.type = "button";
  next.setAttribute("aria-label", "Next");
  next.textContent = ">";
  next.addEventListener("click", onNext);

  header.append(previous, label, next);
  return header;
}

function resolveInitialViewDate(value: string, mode: PickerMode) {
  if (mode === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, 1);
    }
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatPickerAriaDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    weekday: "long",
    year: "numeric"
  }).format(date);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}
