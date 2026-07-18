/**
 * @file 한글 책임: `ui audit.spec` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import { expect, test, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

const supabaseUrl = process.env.E2E_SUPABASE_URL;
const supabaseKey = process.env.E2E_SUPABASE_KEY;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const partnerEmail = process.env.E2E_PARTNER_EMAIL;
const partnerPassword = process.env.E2E_PARTNER_PASSWORD;

const adminRoutes = [
  "/admin",
  "/admin/agencies",
  "/admin/domestic-suppliers",
  "/admin/exchange-rates",
  "/admin/quote-cases",
  "/admin/reservations",
  "/admin/confirmations",
  "/admin/guide-expenses",
  "/admin/workflows",
  "/admin/finance/invoices",
  "/admin/finance/settlements",
  "/admin/migrations/notion-csv",
  "/admin/readiness"
];

const partnerRoutes = [
  "/agency",
  "/agency/inquiries",
  "/agency/inquiries/new",
  "/agency/quote-cases",
  "/agency/reservations",
  "/agency/invoices",
  "/agency/workflows",
  "/agency/account/users"
];

// 파트너 화면에서 허용하지 않는 관리자용 고정 UI 문구입니다. 단체명이나 일정처럼 사용자가 입력한
// 콘텐츠의 언어까지 제한하지 않고, 제품 인터페이스가 영어 전용인지 정확히 확인합니다.
const partnerKoreanUiLabels = ["관리자", "견적 관리", "예약 관리", "환율 관리", "국내 공급사", "로그인", "로그아웃"];

test.describe("authenticated UI audit", () => {
  test.setTimeout(120_000);

  test("admin core routes stay authenticated and visually bounded", async ({ context, page }, testInfo) => {
    test.skip(!hasAdminCredentials(), "Hosted admin E2E credentials are not configured");
    const accessToken = await signIn(adminEmail!, adminPassword!);
    await setSessionCookie(context, accessToken);

    for (const path of adminRoutes) {
      await auditRoute(page, path, testInfo);
    }

    const reservation = await firstApiRecord(page, "/api/reservations?page=1&pageSize=1");
    if (reservation?.id) {
      const reservationId = encodeURIComponent(String(reservation.id));
      await auditRoute(page, `/admin/reservations/${reservationId}`, testInfo);
      await auditRoute(page, `/admin/reservations/${reservationId}/operation-checklist`, testInfo);
      await auditRoute(page, `/admin/confirmations/${reservationId}`, testInfo);
      await auditRoute(page, `/admin/guide-expenses/${reservationId}`, testInfo);
    }
    const quoteCase = await firstApiRecord(page, "/api/quote-cases?page=1&pageSize=1");
    if (quoteCase?.id) await auditRoute(page, `/admin/quote-cases/${encodeURIComponent(String(quoteCase.id))}`, testInfo);
    const invoice = await firstApiRecord(page, "/api/finance/invoices?page=1&pageSize=1");
    if (invoice?.id) await auditRoute(page, `/admin/finance/invoices/${encodeURIComponent(String(invoice.id))}`, testInfo);
    const workflow = await firstApiRecord(page, "/api/workflows?page=1&pageSize=1");
    if (workflow?.workflowCode) {
      await auditRoute(page, `/admin/workflows/${encodeURIComponent(String(workflow.workflowCode))}`, testInfo);
    }

    // More 메뉴는 버튼 재클릭뿐 아니라 화면의 다른 곳을 클릭해도 닫혀야 합니다.
    await page.goto("/admin");
    const moreTrigger = page.locator(".nav-more-trigger");
    await moreTrigger.click();
    await expect(page.locator(".nav-more-menu")).toBeVisible();
    const viewport = page.viewportSize();
    await page.mouse.click(Math.max(1, (viewport?.width ?? 800) - 12), Math.max(1, (viewport?.height ?? 600) - 12));
    await expect(page.locator(".nav-more-menu")).toBeHidden();

    await page.goto("/admin/quote-cases");
    const quoteEditor = page.locator(".quote-create-disclosure");
    await quoteEditor.locator("summary").click();
    await expect(quoteEditor.getByRole("button", { name: "Load Excel Sample" })).toBeVisible();
    await quoteEditor.getByRole("button", { name: "Load Excel Sample" }).click();
    await expect(quoteEditor).toContainText("Excel sample loaded");
  });

  test("partner core routes stay authenticated, English, and visually bounded", async ({ context, page }, testInfo) => {
    test.skip(!hasPartnerCredentials(), "Hosted partner E2E credentials are not configured");
    const accessToken = await signIn(partnerEmail!, partnerPassword!);
    await setSessionCookie(context, accessToken);

    for (const path of partnerRoutes) {
      await auditRoute(page, path, testInfo, { partnerSurface: true });
    }

    const quoteCase = await firstApiRecord(page, "/api/agency/quote-cases?page=1&pageSize=1");
    if (quoteCase?.shareId) {
      await auditRoute(page, `/agency/quote-cases/${encodeURIComponent(String(quoteCase.shareId))}`, testInfo, {
        partnerSurface: true
      });
    }
    const reservation = await firstApiRecord(page, "/api/agency/reservations?page=1&pageSize=1");
    if (reservation?.id) {
      await auditRoute(page, `/agency/reservations/${encodeURIComponent(String(reservation.id))}`, testInfo, {
        partnerSurface: true
      });
    }
    const invoice = await firstApiRecord(page, "/api/agency/invoices?page=1&pageSize=1");
    if (invoice?.id) {
      await auditRoute(page, `/agency/invoices/${encodeURIComponent(String(invoice.id))}`, testInfo, {
        partnerSurface: true
      });
    }
    const workflow = await firstApiRecord(page, "/api/workflows?page=1&pageSize=1");
    if (workflow?.workflowCode) {
      await auditRoute(page, `/agency/workflows/${encodeURIComponent(String(workflow.workflowCode))}`, testInfo, {
        partnerSurface: true
      });
    }

    await page.goto("/agency");
    await expect(page.getByText("Partner Log In", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Partner Sign-up", { exact: true })).toHaveCount(0);
    await expect(page.locator(".partner-access-panel")).toContainText("Open Communication");

    await page.goto("/agency/inquiries/new");
    const firstDateInput = page.locator('input[data-jht-calendar-enhanced="date"]').first();
    await expect(firstDateInput).toHaveAttribute("placeholder", "YYYY-MM-DD");
    await firstDateInput.click();
    await expect(page.locator('.jht-english-calendar[aria-label="English calendar picker"]')).toBeVisible();
    await expect(page.locator(".jht-calendar-weekdays")).toContainText("Sun");
  });
});

async function auditRoute(
  page: Page,
  path: string,
  testInfo: TestInfo,
  options: { partnerSurface?: boolean } = {}
) {
  const browserErrors: string[] = [];
  const failedRequests: string[] = [];
  const serverErrors: string[] = [];
  const onPageError = (error: Error) => browserErrors.push(error.message);
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error") browserErrors.push(message.text());
  };
  const onRequestFailed = (request: { url(): string; failure(): { errorText: string } | null }) => {
    // Next.js가 다음 화면을 미리 가져오던 RSC 요청을 전체 페이지 이동 시 취소하는 것은 정상 동작입니다.
    if (request.failure()?.errorText.includes("ERR_ABORTED")) return;
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? "request failed"}`);
  };
  const onResponse = (response: { status(): number; url(): string }) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  try {
    const response = await page.goto(path, { waitUntil: "load" });
    expect(response?.status(), `${path} document response`).toBeLessThan(500);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(150);

    const finalPath = new URL(page.url()).pathname;
    expect(finalPath, `${path} unexpectedly redirected to a login page`).not.toMatch(/\/(?:auth|agency)\/login$/);
    expect(finalPath, `${path} changed to an unexpected route`).toBe(path);

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const viewportWidth = root.clientWidth;
      const oversizedImages = Array.from(document.images)
        .map((image) => {
          const rect = image.getBoundingClientRect();
          return { alt: image.alt, height: rect.height, src: image.currentSrc || image.src, width: rect.width };
        })
        .filter((image) => image.width > viewportWidth + 2);
      const collapsedControls = Array.from(document.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href]"))
        .filter((element) => {
          const style = window.getComputedStyle(element);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            element.getAttribute("aria-hidden") === "true" ||
            element.getClientRects().length === 0
          ) return false;
          const rect = element.getBoundingClientRect();
          return rect.width < 1 || rect.height < 1;
        })
        .slice(0, 10)
        .map((element) => element.outerHTML.slice(0, 160));
      const misalignedToolbars = Array.from(
        document.querySelectorAll<HTMLElement>(".toolbar, .workflow-filter-bar, .confirmation-filter-bar")
      )
        .map((toolbar) => {
          const heights = Array.from(toolbar.querySelectorAll<HTMLElement>("button, input:not([type='hidden']), select"))
            .filter((element) => element.getClientRects().length > 0)
            .map((element) => Math.round(element.getBoundingClientRect().height));
          return {
            className: toolbar.className,
            difference: heights.length > 1 ? Math.max(...heights) - Math.min(...heights) : 0,
            heights
          };
        })
        .filter((toolbar) => toolbar.difference > 3);

      return {
        collapsedControls,
        horizontalOverflow: root.scrollWidth - root.clientWidth,
        misalignedToolbars,
        oversizedImages
      };
    });

    expect(layout.horizontalOverflow, `${path} has document-level horizontal overflow`).toBeLessThanOrEqual(2);
    expect(layout.oversizedImages, `${path} renders an image wider than the viewport`).toEqual([]);
    expect(layout.collapsedControls, `${path} contains visible zero-size controls`).toEqual([]);
    expect(layout.misalignedToolbars, `${path} has mismatched toolbar control heights`).toEqual([]);
    expect(browserErrors, `${path} emitted browser errors`).toEqual([]);
    expect(failedRequests, `${path} contains failed network requests`).toEqual([]);
    expect(serverErrors, `${path} returned server errors`).toEqual([]);

    // 프로덕션 연결 점검에서는 빈 DB나 권한 오류를 샘플 업무 데이터로 위장하면 안 됩니다.
    await expect(page.locator("body"), `${path} exposes development preview rows in production`).not.toContainText("Preview data");

    if (options.partnerSurface) {
      await expect(page.locator("html")).toHaveAttribute("lang", /en/i);
      const bodyText = await page.locator("body").innerText();
      const leakedLabels = partnerKoreanUiLabels.filter((label) => bodyText.includes(label));
      expect(leakedLabels, `${path} contains Korean administrator UI labels`).toEqual([]);
    }

    if (["/admin", "/admin/reservations", "/admin/quote-cases", "/agency", "/agency/inquiries/new"].includes(path)) {
      const fileName = `${testInfo.project.name}-${path.replace(/^\//, "").replaceAll("/", "-")}.png`;
      await page.screenshot({ fullPage: true, path: testInfo.outputPath(fileName) });
    }
  } finally {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    page.off("requestfailed", onRequestFailed);
    page.off("response", onResponse);
  }
}

async function firstApiRecord(page: Page, path: string): Promise<Record<string, unknown> | null> {
  const response = await page.request.get(path);
  expect(response.status(), `${path} API response`).toBeLessThan(500);
  if (!response.ok()) return null;
  const payload = await response.json();
  return Array.isArray(payload.data) && payload.data.length > 0 ? payload.data[0] : null;
}

async function signIn(email: string, password: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: supabaseKey!, "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`E2E sign-in failed with status ${response.status}`);
  return String(payload.access_token);
}

async function setSessionCookie(context: BrowserContext, accessToken: string) {
  const baseUrl = new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3116");
  await context.addCookies([
    {
      name: "jht_access_token",
      value: accessToken,
      domain: baseUrl.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}

function hasAdminCredentials() {
  return Boolean(supabaseUrl && supabaseKey && adminEmail && adminPassword);
}

function hasPartnerCredentials() {
  return Boolean(supabaseUrl && supabaseKey && partnerEmail && partnerPassword);
}
