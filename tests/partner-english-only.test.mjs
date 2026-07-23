/**
 * @file 한글 책임: `partner english only.test` 테스트는 관련 사용자 흐름과 보안·데이터 규칙의 회귀를 방지합니다.
 * 성공 경로뿐 아니라 권한 거부, 잘못된 입력, 재시도 및 경계 상태를 함께 검증해 배포 전 계약 위반을 탐지합니다.
 */
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

test("partner requests ignore the administrator Korean locale", async () => {
  const middleware = await readSource("src/middleware.ts");
  const layout = await readSource("src/app/layout.tsx");
  const topbar = await readSource("src/components/AppTopbar.tsx");
  const shell = await readSource("src/components/agency/PartnerWorkspaceShell.tsx");

  assert.match(middleware, /requestHeaders\.set\("x-jht-locale", "en"\)/);
  // 관리자 한국어 번역은 서버 렌더 시점에 적용됩니다. 하이드레이션 이후 DOM 텍스트를 바꾸던
  // GlobalTextTranslator는 제거되어 더 이상 마운트되지 않습니다(불일치·깜빡임 원인 제거).
  assert.doesNotMatch(layout, /GlobalTextTranslator/);
  // 파트너 화면은 effectiveLocale을 en으로 고정해 관리자 KOR 설정을 무시합니다.
  assert.match(topbar, /const effectiveLocale = isAgencySurface \? "en" : locale/);
  assert.match(shell, /document\.documentElement\.lang = "en-US"/);
  assert.match(shell, /lang="en-US"/);
});

test("partner page UI source contains no Korean display text", async () => {
  const sourceFiles = [
    ...(await listSourceFiles("src/app/agency")),
    ...(await listSourceFiles("src/components/agency")),
    "src/components/workflow/WorkflowLedger.tsx"
  ];

  for (const file of sourceFiles) {
    const displaySource = stripComments(await readSource(file));
    assert.doesNotMatch(displaySource, /[가-힣]/, `${file} contains Korean partner-facing text`);
  }
});

test("partner-facing locale formatting is explicitly English", async () => {
  const workflowLedger = await readSource("src/components/workflow/WorkflowLedger.tsx");
  assert.match(workflowLedger, /toLocaleString\("en-US"/);

  for (const file of await listSourceFiles("src/app/agency")) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /toLocale(?:String|DateString|TimeString)\(\)/, `${file} uses the browser locale`);
  }
});

async function listSourceFiles(relativeDirectory) {
  const directory = path.join(repositoryRoot, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(relativePath)));
    if (entry.isFile() && /\.(?:ts|tsx|mjs)$/.test(entry.name)) files.push(relativePath);
  }
  return files;
}

async function readSource(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
