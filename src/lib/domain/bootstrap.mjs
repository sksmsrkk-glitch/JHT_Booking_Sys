export function buildInitialAdminBootstrapRows({ authUserId, email, displayName, companyId }) {
  const normalizedAuthUserId = requireText(authUserId, "authUserId");
  const normalizedEmail = requireEmail(email);
  const normalizedDisplayName = normalizeOptionalText(displayName) ?? normalizedEmail;

  return {
    profile: {
      id: normalizedAuthUserId,
      email: normalizedEmail,
      display_name: normalizedDisplayName,
      default_company_id: normalizeOptionalText(companyId),
      status: "active"
    },
    roles: [
      {
        user_id: normalizedAuthUserId,
        role: "admin"
      },
      {
        user_id: normalizedAuthUserId,
        role: "finance"
      }
    ]
  };
}

export function buildInitialCompanyBootstrapRow({ code = "JHT", nameKo = "정호여행사", nameEn = "Jungho Travel" } = {}) {
  return {
    code: requireCompanyCode(code),
    name_ko: requireText(nameKo, "nameKo"),
    name_en: requireText(nameEn, "nameEn"),
    status: "active"
  };
}

export function assertBootstrapAllowed({ adminRoleCount }) {
  if (Number(adminRoleCount ?? 0) > 0) {
    throw new Error("Initial admin bootstrap is already completed");
  }
  return true;
}

function requireCompanyCode(value) {
  const normalized = requireText(value, "companyCode").toUpperCase();
  if (!/^[A-Z0-9_-]{2,20}$/.test(normalized)) {
    throw new Error("companyCode must be 2-20 uppercase letters, numbers, underscores, or hyphens");
  }
  return normalized;
}

function requireEmail(value) {
  const normalized = requireText(value, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("email must be a valid email address");
  }
  return normalized;
}

function requireText(value, field) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}
