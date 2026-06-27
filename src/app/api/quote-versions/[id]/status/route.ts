import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

type QuoteVersionStatus = "draft" | "review" | "sent" | "accepted" | "superseded" | "cancelled";
type QuoteVersionRow = {
  id: string;
  quote_case_id: string;
  version_no: number;
  status: QuoteVersionStatus;
  public_total_amount: number;
};

const ALLOWED_NEXT_STATUSES = ["sent", "accepted", "cancelled"] as const;

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const quoteVersionId = requireUuid(id, "id");
    const body = await readJson<Record<string, unknown>>(request);
    const nextStatus = requireString(body.status, "status") as (typeof ALLOWED_NEXT_STATUSES)[number];

    if (!ALLOWED_NEXT_STATUSES.includes(nextStatus)) {
      throw new HttpError(400, "Unsupported quote version status");
    }

    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const before = await getQuoteVersion(supabase, quoteVersionId);
    const update = buildStatusUpdate(before, nextStatus);

    const { data: quoteVersion, error: updateError } = await supabase
      .from("quote_versions")
      .update(update.versionUpdate)
      .eq("id", quoteVersionId)
      .select("id, quote_case_id, version_no, status, sent_at, accepted_at, public_total_amount")
      .single();

    if (updateError) throw new HttpError(500, updateError.message);

    if (nextStatus === "sent") {
      const { error: supersedeError } = await supabase
        .from("quote_versions")
        .update({ status: "superseded" })
        .eq("quote_case_id", before.quote_case_id)
        .neq("id", quoteVersionId)
        .eq("status", "sent");

      if (supersedeError) throw new HttpError(500, supersedeError.message);
    }

    if (nextStatus === "accepted") {
      const { error: supersedeError } = await supabase
        .from("quote_versions")
        .update({ status: "superseded" })
        .eq("quote_case_id", before.quote_case_id)
        .neq("id", quoteVersionId)
        .eq("status", "sent");

      if (supersedeError) throw new HttpError(500, supersedeError.message);
    }

    const { error: caseError } = await supabase
      .from("quote_cases")
      .update({ status: update.quoteCaseStatus })
      .eq("id", before.quote_case_id);

    if (caseError) throw new HttpError(500, caseError.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "quote_version.status_updated",
      entityTable: "quote_versions",
      entityId: quoteVersionId,
      beforeData: before,
      afterData: quoteVersion
    });

    return ok({ quoteVersion, quoteCaseStatus: update.quoteCaseStatus });
  } catch (error) {
    return fail(error);
  }
}

async function getQuoteVersion(supabase: any, quoteVersionId: string) {
  const { data, error } = await supabase
    .from("quote_versions")
    .select("id, quote_case_id, version_no, status, public_total_amount")
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, "Quote version not found");
  return data as QuoteVersionRow;
}

function buildStatusUpdate(before: QuoteVersionRow, nextStatus: "sent" | "accepted" | "cancelled") {
  if (nextStatus === "sent") {
    if (!["draft", "review"].includes(before.status)) {
      throw new HttpError(409, `Quote version cannot be sent from ${before.status}`);
    }
    if (Number(before.public_total_amount ?? 0) <= 0) {
      throw new HttpError(409, "Quote version must have a public total before sending");
    }
    return {
      quoteCaseStatus: "sent",
      versionUpdate: { status: "sent", sent_at: new Date().toISOString() }
    };
  }

  if (nextStatus === "accepted") {
    if (before.status !== "sent") {
      throw new HttpError(409, `Quote version cannot be accepted from ${before.status}`);
    }
    return {
      quoteCaseStatus: "accepted",
      versionUpdate: { status: "accepted", accepted_at: new Date().toISOString() }
    };
  }

  if (!["draft", "review", "sent"].includes(before.status)) {
    throw new HttpError(409, `Quote version cannot be cancelled from ${before.status}`);
  }

  return {
    quoteCaseStatus: before.status === "sent" ? "cancelled" : "quoting",
    versionUpdate: { status: "cancelled" }
  };
}
