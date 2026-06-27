export const MANAGEABLE_INTERNAL_ROLES = [
  "admin",
  "sales",
  "operations",
  "hotel_booking",
  "vehicle_booking",
  "guide_assignment",
  "content_booking",
  "finance"
];

export function buildInternalUserRoleRows({ userId, roles }) {
  const normalizedUserId = requireText(userId, "userId");
  const normalizedRoles = normalizeRoles(roles);
  if (normalizedRoles.length === 0) {
    throw new Error("At least one internal role is required");
  }

  return normalizedRoles.map((role) => ({
    user_id: normalizedUserId,
    role
  }));
}

export function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    throw new Error("roles must be an array");
  }

  return Array.from(new Set(roles.map((role) => requireText(role, "role")))).map((role) => {
    if (!MANAGEABLE_INTERNAL_ROLES.includes(role)) {
      throw new Error(`Unsupported internal role: ${role}`);
    }
    return role;
  });
}

export function buildInternalProfileRow({ authUserId, email, displayName, companyId }) {
  const normalizedEmail = requireEmail(email);
  return {
    id: requireText(authUserId, "authUserId"),
    email: normalizedEmail,
    display_name: normalizeOptionalText(displayName) ?? normalizedEmail,
    default_company_id: normalizeOptionalText(companyId),
    status: "active"
  };
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
