const REDACTED_KEYS = [
  "authorization",
  "cookie",
  "secret",
  "token",
  "key",
  "password",
  "passport",
  "body",
  "bodyText",
  "providerPayload"
];

export function sanitizeApiLogPayload(value, depth = 0) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeApiLogPayload(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (isSensitiveKey(key)) return [key, "[redacted]"];
        return [key, sanitizeApiLogPayload(entryValue, depth + 1)];
      })
    );
  }

  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...` : value;
  }

  return value;
}

function isSensitiveKey(key) {
  const normalized = String(key).toLowerCase();
  return REDACTED_KEYS.some((sensitiveKey) => normalized.includes(sensitiveKey.toLowerCase()));
}
