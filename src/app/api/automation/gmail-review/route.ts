import { listGmailReviewItems } from "@/features/automation/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const items = await listGmailReviewItems(supabase, {
      review: url.searchParams.get("review") ?? undefined
    });

    return ok(items);
  } catch (error) {
    return fail(error);
  }
}
