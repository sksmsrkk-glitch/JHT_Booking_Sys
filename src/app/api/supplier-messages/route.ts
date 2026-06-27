import { listSupplierMessages } from "@/features/supplier-comms/queries";
import { requireInternalUser } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const messages = await listSupplierMessages(supabase, {
      status: url.searchParams.get("status") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
      messageType: url.searchParams.get("messageType") ?? undefined
    });

    return ok(messages);
  } catch (error) {
    return fail(error);
  }
}
