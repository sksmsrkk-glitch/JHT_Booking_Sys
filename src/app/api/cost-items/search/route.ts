import { searchCostItems } from "@/features/costing/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const data = await searchCostItems(supabase, {
      q: url.searchParams.get("q"),
      category: url.searchParams.get("category"),
      region: url.searchParams.get("region"),
      limit: Number(url.searchParams.get("limit") ?? 50)
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
