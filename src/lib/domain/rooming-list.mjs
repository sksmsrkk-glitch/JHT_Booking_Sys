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
        passenger[field] = field === "dateOfBirth" ? normalizeDate(value) : value;
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

export function detectDelimiter(text) {
  const firstLine = String(text ?? "").split(/\r?\n/)[0] ?? "";
  const commaCount = countUnquoted(firstLine, ",");
  const tabCount = countUnquoted(firstLine, "\t");
  return tabCount > commaCount ? "\t" : ",";
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

function normalizeDate(value) {
  const trimmed = String(value ?? "").trim();
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }
  return trimmed;
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
