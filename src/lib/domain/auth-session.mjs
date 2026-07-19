/**
 * @file 한글 책임: `auth session` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
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
 * 형식이 잘못되었거나 exp가 없는 값도 보호 경로를 통과하지 못하도록 만료 토큰과 동일하게 처리합니다.
 */
export function isAccessTokenStale(token, nowSeconds = Math.floor(Date.now() / 1000), refreshSkewSeconds = 60) {
  const payload = readJwtPayload(token);
  return typeof payload?.exp !== "number" || payload.exp <= nowSeconds + refreshSkewSeconds;
}

/**
 * 보호 화면 진입 전에 토큰이 현재 Supabase 프로젝트에서 발급된 사용자 토큰인지 확인합니다.
 * 여기서는 빠른 형식 검사를 수행하고, 실제 서명 검증은 API 경계의 getClaims(jwt)가 담당합니다.
 */
export function isAccessTokenForProject(token, supabaseUrl) {
  const payload = readJwtPayload(token);
  if (!payload || typeof payload.iss !== "string" || typeof payload.sub !== "string" || !payload.sub) return false;
  if (typeof supabaseUrl !== "string" || !supabaseUrl.trim()) return false;

  const expectedIssuer = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1`;
  return payload.iss === expectedIssuer;
}

/** Authorization 헤더에서 Bearer 토큰만 엄격하게 추출합니다. */
export function extractBearerToken(authorization) {
  if (typeof authorization !== "string") return "";
  const match = authorization.trim().match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

/**
 * Supabase Auth가 요청 JWT의 서명과 만료를 검증한 클레임만 반환합니다.
 * 토큰을 인자로 전달하지 않으면 서버 클라이언트의 비영속 세션에서는 항상 빈 결과가 되므로
 * 이 함수가 모든 호출부에서 명시적인 accessToken 사용을 강제합니다.
 */
export async function getVerifiedAccessTokenClaims(authClient, accessToken) {
  if (!authClient || typeof authClient.getClaims !== "function" || !accessToken) return null;
  const { data, error } = await authClient.getClaims(accessToken);
  return error ? null : data?.claims ?? null;
}

function readJwtPayload(token) {
  if (typeof token !== "string") return null;
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
