import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const containerName = "supabase_db_jht-operations-platform";
const sql = readFileSync(new URL("./sql/verify-integrity-local.sql", import.meta.url), "utf8");
const running = spawnSync(
  "docker",
  ["ps", "--filter", `name=^/${containerName}$`, "--format", "{{.Names}}"],
  { encoding: "utf8" }
);

if (running.status !== 0) {
  process.stderr.write(running.stderr || "Docker status check failed.\n");
  process.exit(running.status ?? 1);
}
if (running.stdout.trim() !== containerName) {
  console.error("Local Supabase is not running. Run `npx supabase start` first.");
  process.exit(1);
}

const verification = spawnSync(
  "docker",
  ["exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
  { encoding: "utf8", input: sql }
);

if (verification.status !== 0) {
  process.stderr.write(verification.stdout);
  process.stderr.write(verification.stderr);
  process.exit(verification.status ?? 1);
}

console.log("Local integrity verification passed for RPC permissions, atomic partner writes, invoice-scoped payments, full KPI aggregation, and supplier requeue safety.");
