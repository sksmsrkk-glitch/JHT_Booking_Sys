import { ok } from "@/lib/api/http";

export async function GET() {
  return ok({
    status: "ok",
    service: "jht-operations-platform",
    version: "v1",
    generatedAt: new Date().toISOString(),
    checks: {
      supabaseUrlConfigured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKeyConfigured: isConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      automationSecretConfigured: isConfigured(process.env.AUTOMATION_SECRET)
    }
  });
}

function isConfigured(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
