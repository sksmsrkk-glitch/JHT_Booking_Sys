import { setTimeout as delay } from "node:timers/promises";

const baseUrl = new URL(process.env.LOAD_BASE_URL ?? "http://127.0.0.1:3100");
const paths = (process.env.LOAD_PATHS ?? "/admin,/agency,/admin/quote-cases,/agency/quote-cases")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const concurrency = boundedInteger(process.env.LOAD_CONCURRENCY, 10, 1, 100);
const requestCount = boundedInteger(process.env.LOAD_REQUESTS, 200, concurrency, 10_000);
const timeoutMs = boundedInteger(process.env.LOAD_TIMEOUT_MS, 15_000, 500, 60_000);
const warmupCount = boundedInteger(process.env.LOAD_WARMUP_REQUESTS, Math.min(10, requestCount), 0, 100);
const maxP95Ms = boundedNumber(process.env.LOAD_MAX_P95_MS, 1_500, 50, 60_000);
const maxErrorRate = boundedNumber(process.env.LOAD_MAX_ERROR_RATE, 0.01, 0, 1);
const bearerToken = process.env.LOAD_BEARER_TOKEN?.trim();

if (paths.length === 0) {
  throw new Error("LOAD_PATHS must contain at least one path");
}

console.log(
  `Load smoke: ${requestCount} requests, concurrency ${concurrency}, target ${baseUrl.origin}, paths ${paths.join(", ")}`
);

for (let index = 0; index < warmupCount; index += 1) {
  await requestPath(paths[index % paths.length], false);
}

const results = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= requestCount) return;
      results.push(await requestPath(paths[index % paths.length], true));
      if (process.env.LOAD_THINK_MS) await delay(boundedInteger(process.env.LOAD_THINK_MS, 0, 0, 5_000));
    }
  })
);

const durations = results.map((result) => result.durationMs).sort((left, right) => left - right);
const failed = results.filter((result) => !result.ok);
const summary = {
  requests: results.length,
  errors: failed.length,
  errorRate: failed.length / Math.max(results.length, 1),
  p50Ms: percentile(durations, 0.5),
  p95Ms: percentile(durations, 0.95),
  p99Ms: percentile(durations, 0.99),
  maxMs: durations.at(-1) ?? 0
};

console.table(
  paths.map((path) => {
    const pathResults = results.filter((result) => result.path === path);
    const pathDurations = pathResults.map((result) => result.durationMs).sort((left, right) => left - right);
    return {
      path,
      requests: pathResults.length,
      errors: pathResults.filter((result) => !result.ok).length,
      p50Ms: percentile(pathDurations, 0.5),
      p95Ms: percentile(pathDurations, 0.95),
      maxMs: pathDurations.at(-1) ?? 0
    };
  })
);
console.log(JSON.stringify({ event: "load_smoke_summary", ...summary }));

if (failed.length > 0) {
  console.error("Sample failures:");
  for (const failure of failed.slice(0, 10)) {
    console.error(`- ${failure.path}: ${failure.status ?? failure.error}`);
  }
}

if (summary.errorRate > maxErrorRate || summary.p95Ms > maxP95Ms) {
  console.error(`Load budget failed: p95 <= ${maxP95Ms}ms, error rate <= ${(maxErrorRate * 100).toFixed(2)}%`);
  process.exit(1);
}

console.log("Load budget passed.");

async function requestPath(path, measured) {
  const url = new URL(path, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      headers: {
        accept: process.env.LOAD_ACCEPT ?? "text/html,application/json",
        ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
        "x-load-smoke": measured ? "measured" : "warmup"
      },
      redirect: "manual",
      signal: controller.signal
    });
    await response.arrayBuffer();
    return {
      path,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
      durationMs: Number((performance.now() - startedAt).toFixed(1))
    };
  } catch (error) {
    return {
      path,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Number((performance.now() - startedAt).toFixed(1))
    };
  } finally {
    clearTimeout(timeout);
  }
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * ratio) - 1));
  return Number(values[index].toFixed(1));
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
