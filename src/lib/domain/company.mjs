export function buildCompanyCreateRow({ code, nameKo, nameEn }) {
  return {
    code: requireCompanyCode(code),
    name_ko: requireText(nameKo, "nameKo"),
    name_en: requireText(nameEn, "nameEn"),
    status: "active"
  };
}

function requireCompanyCode(value) {
  const normalized = requireText(value, "code").toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(normalized)) {
    throw new Error("code must be 2-20 uppercase letters, numbers, underscores, or hyphens");
  }
  return normalized;
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}
