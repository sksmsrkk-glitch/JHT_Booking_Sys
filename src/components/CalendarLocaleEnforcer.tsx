"use client";

import { useEffect } from "react";

const englishCalendarLocale = "en-US";
const dateInputSelector = 'input[type="date"], input[data-jht-original-type="date"]';
const monthInputSelector = 'input[type="month"], input[data-jht-original-type="month"]';
const localeOnlySelector = ['input[type="datetime-local"]', 'input[type="week"]', 'input[type="time"]'].join(",");
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
      positionPicker();
      popover.hidden = false;
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
      const width = activeMode === "month" ? 300 : 316;
      const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - width - 16);
      popover.style.left = `${Math.max(12, left)}px`;
      popover.style.top = `${window.scrollY + rect.bottom + 6}px`;
      popover.style.width = `${width}px`;
    };

    const enhanceRoot = (root: ParentNode | Element) => {
      const dateInputs = collectInputs(root, dateInputSelector);
      const monthInputs = collectInputs(root, monthInputSelector);
      const localeOnlyInputs = collectInputs(root, localeOnlySelector);

      for (const input of dateInputs) enhancePickerInput(input, "date", openPicker);
      for (const input of monthInputs) enhancePickerInput(input, "month", openPicker);
      for (const input of localeOnlyInputs) applyLocaleOnly(input);
    };

    enhanceRoot(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          enhanceRoot(mutation.target);
          continue;
        }

        for (const node of mutation.addedNodes) {
          if (node instanceof Element) enhanceRoot(node);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["type"],
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

function enhancePickerInput(
  input: HTMLInputElement,
  mode: PickerMode,
  openPicker: (input: HTMLInputElement, mode: PickerMode) => void
) {
  if (input.dataset.jhtCalendarEnhanced === mode && input.type === "text") {
    applyEnglishCalendarAttributes(input, mode);
    return;
  }

  input.dataset.jhtOriginalType = mode;
  input.type = "text";
  input.autocomplete = "off";
  input.inputMode = "numeric";
  input.placeholder = mode === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  input.classList.add("jht-english-calendar-input");
  input.dataset.jhtCalendarEnhanced = mode;
  applyEnglishCalendarAttributes(input, mode);

  input.addEventListener("focus", () => openPicker(input, mode));
  input.addEventListener("click", () => openPicker(input, mode));
}

function applyLocaleOnly(input: HTMLInputElement) {
  input.lang = englishCalendarLocale;
  input.setAttribute("lang", englishCalendarLocale);
  input.setAttribute("data-calendar-locale", englishCalendarLocale);
}

function applyEnglishCalendarAttributes(input: HTMLInputElement, mode: PickerMode) {
  input.lang = englishCalendarLocale;
  input.setAttribute("lang", englishCalendarLocale);
  input.setAttribute("data-calendar-locale", englishCalendarLocale);
  input.setAttribute("aria-label", input.getAttribute("aria-label") ?? (mode === "month" ? "Month" : "Date"));
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
