/**
 * @file 한글 책임: `rooming list` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
const HEADER_ALIASES = new Map([
  ["no", "passengerNo"],
  ["number", "passengerNo"],
  ["passenger no", "passengerNo"],
  ["passenger number", "passengerNo"],
  ["pax no", "passengerNo"],
  ["pax number", "passengerNo"],
  ["name", "fullName"],
  ["full name", "fullName"],
  ["passenger", "fullName"],
  ["passenger name", "fullName"],
  ["pax name", "fullName"],
  ["gender", "gender"],
  ["sex", "gender"],
  ["dob", "dateOfBirth"],
  ["birth date", "dateOfBirth"],
  ["date of birth", "dateOfBirth"],
  ["dietary", "dietaryRequirements"],
  ["dietary requirements", "dietaryRequirements"],
  ["meal", "dietaryRequirements"],
  ["meal request", "dietaryRequirements"],
  ["passport", "passportNo"],
  ["passport no", "passportNo"],
  ["passport number", "passportNo"],
  ["coach", "coachLabel"],
  ["coach label", "coachLabel"],
  ["bus", "coachLabel"],
  ["bus no", "coachLabel"]
]);

export function parseRoomingListText(text, options = {}) {
  const source = String(text ?? "").trim();
  if (!source) {
    return { passengers: [], errors: [] };
  }

  const delimiter = options.delimiter ?? detectDelimiter(source);
  const rows = parseDelimitedRows(source, delimiter).filter((row) => row.some((cell) => cell.trim().length > 0));
  if (rows.length === 0) {
    return { passengers: [], errors: [] };
  }

  const headers = rows[0].map(normalizeHeader);
  const errors = [];
  const passengers = [];

  rows.slice(1).forEach((row, rowIndex) => {
    const passenger = {};
    row.forEach((cell, columnIndex) => {
      const field = headers[columnIndex];
      const value = cell.trim();
      if (field && value) {
        passenger[field] = field === "dateOfBirth" ? normalizeBirthDate(value) : value;
      }
    });

    if (!passenger.fullName) {
      errors.push(`Row ${rowIndex + 2}: fullName is required`);
      return;
    }

    if (!passenger.passengerNo) {
      passenger.passengerNo = String(passengers.length + 1);
    }

    passengers.push(passenger);
  });

  return { passengers, errors };
}

export function normalizeRoomingPassengerRows(passengers = []) {
  const errors = [];
  const seenPassengerNos = new Set();
  const rows = [];

  passengers.forEach((passenger, index) => {
    const passengerNo = normalizeOptionalText(passenger?.passengerNo) ?? String(index + 1);
    const fullName = normalizeOptionalText(passenger?.fullName);

    if (seenPassengerNos.has(passengerNo)) {
      errors.push(`passengers[${index}].passengerNo is duplicated: ${passengerNo}`);
    }
    seenPassengerNos.add(passengerNo);

    if (!fullName) {
      errors.push(`passengers[${index}].fullName is required`);
    }

    rows.push({
      passengerNo,
      fullName,
      gender: normalizeOptionalText(passenger?.gender),
      dateOfBirth: normalizeBirthDateOrNull(normalizeOptionalText(passenger?.dateOfBirth)),
      dietaryRequirements: normalizeOptionalText(passenger?.dietaryRequirements),
      passportNo: normalizeOptionalText(passenger?.passportNo),
      coachLabel: normalizeOptionalText(passenger?.coachLabel),
      metadata: isPlainObject(passenger?.metadata) ? passenger.metadata : {}
    });
  });

  return {
    rows,
    passengerNos: Array.from(seenPassengerNos),
    errors
  };
}

export function detectDelimiter(text) {
  const firstLine = String(text ?? "").split(/\r?\n/)[0] ?? "";
  const commaCount = countUnquoted(firstLine, ",");
  const tabCount = countUnquoted(firstLine, "\t");
  return tabCount > commaCount ? "\t" : ",";
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return HEADER_ALIASES.get(key) ?? null;
}

/*
 * 승객 생년월일을 ISO(YYYY-MM-DD)로 정규화합니다.
 *
 * 이 시스템의 파트너는 대부분 DD/MM 표기 문화권(말레이시아 등)입니다. 예전에는
 * 슬래시 날짜를 미국식 MM/DD로 강제 해석해서 "1/2/1990"(2월 1일)이 1월 2일로
 * 뒤바뀌어 저장됐고, 여권 대조·항공 발권에서 생년월일 불일치를 유발했습니다.
 *
 * 규칙:
 *  - 이미 ISO(YYYY-MM-DD)면 그대로 둡니다.
 *  - 슬래시/하이픈 + 4자리 연도면 한 부분이 12를 넘으면 그 값을 '일'로 확정합니다.
 *  - 둘 다 12 이하로 모호하면 파트너 표기에 맞춰 day-first(DD/MM)로 해석합니다.
 *  - 월/일 범위를 벗어나면 원본을 그대로 반환해 상위 검증/DB가 거르도록 둡니다.
 */
function normalizeBirthDateOrNull(value) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeBirthDate(value);
  return normalized === "" ? null : normalized;
}

export function normalizeBirthDate(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return trimmed;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const parts = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed);
  if (!parts) return trimmed;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const year = parts[3];

  let day;
  let month;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else {
    // 둘 다 모호: 파트너 표기(DD/MM) 우선.
    day = first;
    month = second;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return trimmed;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function countUnquoted(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && char === delimiter) count += 1;
  }
  return count;
}
