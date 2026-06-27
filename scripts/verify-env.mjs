import { readFileSync } from "node:fs";
import { READINESS_ENV_CHECKS } from "../src/lib/domain/readiness.mjs";

const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
const envLines = envExample
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

const envExampleNames = new Set(envLines.map((line) => line.split("=")[0]));
const readinessNames = new Set(READINESS_ENV_CHECKS.map((check) => check.envName));
const failures = [];

for (const check of READINESS_ENV_CHECKS) {
  if (!envExampleNames.has(check.envName)) {
    failures.push(`Missing ${check.envName} in .env.example`);
  }
}

for (const envName of envExampleNames) {
  if (!readinessNames.has(envName)) {
    failures.push(`${envName} exists in .env.example but is not represented in readiness checks`);
  }
}

for (const check of READINESS_ENV_CHECKS) {
  const matchingLine = envLines.find((line) => line.startsWith(`${check.envName}=`));
  if (!matchingLine) continue;
  const value = matchingLine.slice(check.envName.length + 1);
  if (check.required && value.trim().length > 0) {
    failures.push(`${check.envName} is required and should not ship with a default value`);
  }
}

const requiredNames = READINESS_ENV_CHECKS.filter((check) => check.required).map((check) => check.envName);
for (const envName of requiredNames) {
  if (!/_(URL|KEY|SECRET)$/.test(envName)) {
    failures.push(`${envName} is required but does not look like a URL/key/secret env`);
  }
}

if (failures.length > 0) {
  console.error("Environment verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Environment verification passed for ${READINESS_ENV_CHECKS.length} readiness env checks.`);
