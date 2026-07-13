import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_AGENCY_PATHS = [
  "/agency/login",
  "/agency/signup",
  "/agency/forgot-email",
  "/agency/forgot-password",
  "/agency/reset-password"
];
const PUBLIC_ADMIN_PATHS = ["/admin/bootstrap"];

export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production" && ["on", "true", "1"].includes(process.env.JHT_DEMO_MODE ?? "")) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const isPublicAgencyPath = PUBLIC_AGENCY_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
  const isPublicAdminPath = PUBLIC_ADMIN_PATHS.some((publicPath) => path === publicPath || path.startsWith(`${publicPath}/`));
  const protectedAgencyPath = path.startsWith("/agency") && !isPublicAgencyPath;
  // 최초 관리자 계정이 아직 없는 환경에서는 부트스트랩 화면만 로그인 없이 열 수 있어야 한다.
  const protectedAdminPath = path.startsWith("/admin") && !isPublicAdminPath;
  if (!protectedAgencyPath && !protectedAdminPath) return NextResponse.next();
  if (request.cookies.get("jht_access_token")?.value) return NextResponse.next();

  const loginPath = protectedAgencyPath ? "/agency/login" : "/auth/login";
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/agency/:path*"]
};
