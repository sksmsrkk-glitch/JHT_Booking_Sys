/**
 * @file 한글 책임: Playwright 브라우저 테스트의 실행 서버, 브라우저 프로젝트, 재시도 및 결과 보존 정책을 설정합니다.
 * 로컬과 CI에서 같은 사용자 흐름을 재현하되 실패 시 원인을 확인할 수 있는 추적 자료를 남깁니다.
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3116";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npx next start -H 127.0.0.1 -p 3116",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000
      }
});
