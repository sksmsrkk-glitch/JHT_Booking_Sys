/**
 * @file 한글 책임: `verify repo safety` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = resolve(".");
const ignoredDirectories = new Set([
  ".git",
  ".claude",
  ".next",
  "node_modules",
  ".turbo",
  "coverage",
  "dist",
  "build"
]);

const secretEnvNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTOMATION_SECRET",
  "GMAIL_WEBHOOK_SECRET",
  "SUPPLIER_MESSAGE_WEBHOOK_SECRET",
  "INITIAL_ADMIN_BOOTSTRAP_SECRET",
  "EMAIL_PROVIDER_API_KEY",
  "KAKAO_BIZ_API_KEY",
  "GOOGLE_MAPS_API_KEY"
];

const tokenPatterns = [
  { name: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
  { name: "JWT token", pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/ }
];

const demoValues = new Map([
  [
    "demo-admin@junghotravel.local",
    new Set(["README.md", "docs/launch-runbook.md", "scripts/verify-repo-safety.mjs", "scripts/verify-seed.mjs", "supabase/seed.sql", "tests/schema-boundary.test.mjs"])
  ],
  [
    "agency-user@worldtravellers.example",
    new Set(["docs/launch-runbook.md", "scripts/verify-repo-safety.mjs", "scripts/verify-seed.mjs", "supabase/seed.sql"])
  ],
  ["JhtDemo!2026", new Set(["README.md", "scripts/verify-repo-safety.mjs", "scripts/verify-seed.mjs", "supabase/seed.sql"])]
]);

const failures = [];
let fileCount = 0;

for (const filePath of listFiles(root)) {
  const relativePath = normalizePath(filePath.slice(root.length + 1));
  const source = readFileSync(filePath, "utf8");
  fileCount += 1;

  for (const line of source.split(/\r?\n/)) {
    const assignment = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!assignment) continue;
    const [, envName, rawValue] = assignment;
    if (secretEnvNames.includes(envName) && rawValue.trim().length > 0) {
      failures.push(`${relativePath} contains a non-empty secret assignment: ${envName}`);
    }
  }

  for (const token of tokenPatterns) {
    if (token.pattern.test(source)) {
      failures.push(`${relativePath} contains a possible ${token.name}`);
    }
  }

  for (const [value, allowedPaths] of demoValues) {
    if (source.includes(value) && !allowedPaths.has(relativePath)) {
      failures.push(`${relativePath} contains local demo value outside its allowlist: ${value}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Repository safety verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Repository safety verification passed for ${fileCount} source files.`);

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = resolve(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return ignoredDirectories.has(entry) ? [] : listFiles(fullPath);
    }
    if (!isTextFile(entry)) return [];
    return [fullPath];
  });
}

function isTextFile(fileName) {
  return /\.(css|d\.ts|env|example|json|js|jsx|md|mjs|sql|ts|tsx|txt|yml|yaml)$/.test(fileName);
}

function normalizePath(path) {
  return path.split(sep).join("/");
}
