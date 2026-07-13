export const ACCESS_TOKEN_COOKIE = "jht_access_token";
export const REFRESH_TOKEN_COOKIE = "jht_refresh_token";

const allowedRoutePrefixes = {
  agency: "/agency",
  internal: "/admin"
};

/**
 * 로그인 페이지의 next 값은 같은 포털 안의 절대 경로만 허용합니다.
 * 외부 URL, 이중 슬래시, 다른 포털 경로는 기본 대시보드로 되돌려 오픈 리디렉션을 막습니다.
 */
export function resolvePostLoginPath(accountType, requestedPath) {
  const fallback = allowedRoutePrefixes[accountType] ?? "/";
  if (typeof requestedPath !== "string" || !requestedPath.startsWith("/") || requestedPath.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(requestedPath, "https://jht.local");
    const prefix = allowedRoutePrefixes[accountType];
    if (!prefix || parsed.origin !== "https://jht.local") return fallback;
    if (parsed.pathname !== prefix && !parsed.pathname.startsWith(`${prefix}/`)) return fallback;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

/**
 * Supabase access token의 exp를 읽어 만료 또는 임박 여부를 판단합니다.
 * 형식이 JWT가 아닌 테스트 토큰은 기존 런타임 스모크와 호환되도록 즉시 만료 처리하지 않습니다.
 */
export function isAccessTokenStale(token, nowSeconds = Math.floor(Date.now() / 1000), refreshSkewSeconds = 60) {
  const expiresAt = readJwtExpiry(token);
  return expiresAt === null ? false : expiresAt <= nowSeconds + refreshSkewSeconds;
}

function readJwtExpiry(token) {
  if (typeof token !== "string") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) ? parsed.exp : null;
  } catch {
    return null;
  }
}
