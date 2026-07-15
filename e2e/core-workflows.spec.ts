import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const localSupabaseUrl = process.env.E2E_SUPABASE_URL;
const localSupabaseKey = process.env.E2E_SUPABASE_KEY;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test("admin and partner shells render without hydration or overflow failures", async ({ page }) => {
  const errors = collectBrowserErrors(page);
  for (const path of ["/admin", "/agency", "/admin/quote-cases", "/agency/quote-cases"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} has horizontal overflow`).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test("authenticated reservation dashboard uses database aggregates and bounded lists", async ({ context, page }) => {
  test.skip(!localSupabaseUrl || !localSupabaseKey || !adminEmail || !adminPassword, "Local Supabase E2E credentials are not configured");
  const accessToken = await signInForAccessToken();
  await setSessionCookie(context, accessToken);
  const errors = collectBrowserErrors(page);

  await page.goto("/admin/reservations?month=2026-09&page=1&pageSize=20&sortBy=incomplete_first");
  await expect(page.getByRole("heading", { name: "Reservations", exact: true })).toBeVisible();
  await expect(page.getByText("Active groups", { exact: true })).toBeVisible();
  await expect(page.getByText("Action Item List", { exact: true })).toBeVisible();
  await expect(page.locator(".pagination-summary")).toContainText("1 records");
  const calendarBars = page.locator(".reservation-event-bar");
  await expect(calendarBars.first()).toBeVisible();
  expect(await calendarBars.count()).toBeLessThanOrEqual(6);
  expect(errors).toEqual([]);
});

test("paginated list API exposes correlation and timing headers", async ({ request }) => {
  test.skip(!localSupabaseUrl || !localSupabaseKey || !adminEmail || !adminPassword, "Local Supabase E2E credentials are not configured");
  const accessToken = await signInForAccessToken();
  const response = await request.get("/api/reservations?page=1&pageSize=20", {
    headers: { authorization: `Bearer ${accessToken}`, "x-request-id": "playwright-e2e" }
  });
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-request-id"]).toBe("playwright-e2e");
  expect(response.headers()["server-timing"]).toMatch(/^app;dur=/);
  const payload = await response.json();
  expect(payload.pagination).toMatchObject({ page: 1, pageSize: 20 });
  expect(Array.isArray(payload.data)).toBeTruthy();
});

async function signInForAccessToken() {
  const response = await fetch(`${localSupabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: localSupabaseKey!, "content-type": "application/json" },
    body: JSON.stringify({ email: adminEmail, password: adminPassword })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`E2E sign-in failed: ${JSON.stringify(payload)}`);
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

function collectBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}
