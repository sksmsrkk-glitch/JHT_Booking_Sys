/**
 * @file 한글 책임: `verify launch runbook` 검증기는 저장소의 코드·스키마·문서 계약이 배포 기준을 지키는지 자동 확인합니다.
 * 검사 실패는 사람이 놓치기 쉬운 회귀를 CI와 로컬 검증 단계에서 즉시 차단하도록 명확한 종료 코드로 전달합니다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  READINESS_ENV_CHECKS,
  READINESS_LAUNCH_CHECKS,
  READINESS_STORAGE_CHECKS
} from "../src/lib/domain/readiness.mjs";

const runbook = readFileSync(resolve("docs/launch-runbook.md"), "utf8");
const failures = [];

const requiredEnvNames = READINESS_ENV_CHECKS.filter((check) => check.required).map((check) => check.envName).sort();
const optionalEnvNames = READINESS_ENV_CHECKS.filter((check) => !check.required).map((check) => check.envName).sort();
const runbookRequiredEnvNames = readEnvBulletsBetween("Required:", "Recommended before live supplier delivery:").sort();

for (const envName of requiredEnvNames) {
  if (!runbookRequiredEnvNames.includes(envName)) {
    failures.push(`Required readiness env is missing from launch runbook Required list: ${envName}`);
  }
}

for (const envName of runbookRequiredEnvNames) {
  if (!requiredEnvNames.includes(envName)) {
    failures.push(`Launch runbook Required list contains env that is not required by readiness: ${envName}`);
  }
}

for (const envName of [...requiredEnvNames, ...optionalEnvNames]) {
  if (!runbook.includes(envName)) {
    failures.push(`Readiness env is not mentioned in launch runbook: ${envName}`);
  }
}

for (const migrationFile of listMigrationFiles()) {
  if (!runbook.includes(`supabase/migrations/${migrationFile}`)) {
    failures.push(`Migration file is missing from launch runbook migration order: ${migrationFile}`);
  }
}

for (const storageCheck of READINESS_STORAGE_CHECKS) {
  if (!runbook.includes(storageCheck.bucketEnvName)) {
    failures.push(`Storage readiness env is missing from launch runbook: ${storageCheck.bucketEnvName}`);
  }
  if (!runbook.includes(storageCheck.defaultBucket)) {
    failures.push(`Storage default bucket is missing from launch runbook: ${storageCheck.defaultBucket}`);
  }
}

for (const launchCheck of READINESS_LAUNCH_CHECKS) {
  const labelKeywords = launchCheck.label
    .replace(/`[^`]+`/g, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9/:-]/g, ""))
    .filter((word) => word.length >= 6);
  if (!labelKeywords.some((keyword) => runbook.toLowerCase().includes(keyword.toLowerCase()))) {
    failures.push(`Readiness launch check is not represented in launch runbook: ${launchCheck.key}`);
  }
}

if (failures.length > 0) {
  console.error("Launch runbook verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Launch runbook verification passed for ${READINESS_ENV_CHECKS.length} env checks, ${listMigrationFiles().length} migrations, and ${READINESS_LAUNCH_CHECKS.length} launch checks.`
);

function readEnvBulletsBetween(startMarker, endMarker) {
  const start = runbook.indexOf(startMarker);
  const end = runbook.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return [];
  return [...runbook.slice(start, end).matchAll(/^- `([A-Z0-9_]+)`$/gm)].map((match) => match[1]);
}

function listMigrationFiles() {
  return readdirSync(resolve("supabase/migrations")).filter((fileName) => fileName.endsWith(".sql")).sort();
}
