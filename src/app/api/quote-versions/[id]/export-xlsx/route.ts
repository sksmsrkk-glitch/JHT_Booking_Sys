import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError } from "@/lib/api/http";
import { makeExportPath } from "@/lib/domain/ids";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const storagePath = makeExportPath(id);

    const { data, error } = await supabase
      .from("quote_exports")
      .insert({
        quote_version_id: id,
        export_type: "xlsx",
        storage_path: storagePath,
        status: "queued",
        created_by: internalUser.profileId
      })
      .select("id, quote_version_id, export_type, storage_path, status, created_at")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_export.queued",
      entityTable: "quote_exports",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}
