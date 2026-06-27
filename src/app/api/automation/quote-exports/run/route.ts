import { writeAuditLog } from "@/lib/api/audit";
import { requireAutomationSecret } from "@/lib/api/guards";
import { writeApiLog } from "@/lib/api/api-log";
import { fail, HttpError, ok } from "@/lib/api/http";
import { buildQuoteExportSnapshotSummary } from "@/lib/domain/quote-export.mjs";
import { buildQuoteExportWorkbook } from "@/lib/domain/xlsx.mjs";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const EXPORT_STORAGE_BUCKET = process.env.EXPORT_STORAGE_BUCKET || "exports";

export async function POST(request: Request) {
  try {
    requireAutomationSecret(request);
    const supabase = createServiceSupabaseClient();

    const { data: exports, error } = await supabase
      .from("quote_exports")
      .select("id, quote_version_id, storage_path, status, created_at")
      .eq("export_type", "xlsx")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) throw new HttpError(500, error.message);

    const results = [];
    for (const exportRow of exports ?? []) {
      results.push(await processExport(supabase, exportRow));
    }

    const responsePayload = {
      checkedCount: exports?.length ?? 0,
      completedCount: results.filter((result) => result.status === "completed").length,
      failedCount: results.filter((result) => result.status === "failed").length,
      results
    };

    await writeApiLog(supabase, {
      source: "automation_quote_exports",
      endpoint: "/api/automation/quote-exports/run",
      method: "POST",
      statusCode: responsePayload.failedCount > 0 ? 207 : 200,
      responsePayload
    });

    return ok(responsePayload);
  } catch (error) {
    return fail(error);
  }
}

async function processExport(supabase: any, exportRow: any) {
  await updateExport(supabase, exportRow.id, { status: "processing", error_message: null });

  try {
    const snapshot = await loadQuoteVersionSnapshot(supabase, exportRow.quote_version_id);
    const workbook = buildQuoteExportWorkbook(snapshot);
    const storagePath = exportRow.storage_path || `quote-exports/${exportRow.quote_version_id}/${exportRow.id}.xlsx`;

    const { error: uploadError } = await supabase.storage.from(EXPORT_STORAGE_BUCKET).upload(storagePath, workbook, {
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true
    });

    if (uploadError) throw new Error(uploadError.message);

    const completed = await updateExport(supabase, exportRow.id, {
      status: "completed",
      storage_path: storagePath,
      error_message: null
    });

    await writeAuditLog(supabase, {
      action: "quote_export.completed",
      entityTable: "quote_exports",
      entityId: exportRow.id,
      afterData: {
        storageBucket: EXPORT_STORAGE_BUCKET,
        storagePath,
        quoteVersionId: exportRow.quote_version_id,
        workbookBytes: workbook.length
      }
    });

    return { id: exportRow.id, status: "completed", storagePath: completed.storage_path };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown export error";
    await updateExport(supabase, exportRow.id, { status: "failed", error_message: message });
    await writeAuditLog(supabase, {
      action: "quote_export.failed",
      entityTable: "quote_exports",
      entityId: exportRow.id,
      afterData: { quoteVersionId: exportRow.quote_version_id, error: message }
    });
    return { id: exportRow.id, status: "failed", error: message };
  }
}

async function loadQuoteVersionSnapshot(supabase: any, quoteVersionId: string) {
  const { data: version, error: versionError } = await supabase
    .from("quote_versions")
    .select(
      "id, version_no, status, currency, public_total_amount, quote_cases(case_code, tour_name, currency), quote_itinerary_days(id, day_no, service_date, title, public_description, route_segments(id)), quote_items(id, item_category, snapshot_item_name, snapshot_supplier_name, snapshot_unit_cost_amount, quantity, pax_count, total_cost_krw, total_sell_amount)"
    )
    .eq("id", quoteVersionId)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("Quote version not found");

  const itineraryDays = (version.quote_itinerary_days ?? [])
    .map((day: any) => ({
      dayNo: day.day_no,
      serviceDate: day.service_date ?? null,
      title: day.title ?? null,
      publicDescription: day.public_description ?? null,
      routeSegments: day.route_segments ?? []
    }))
    .sort((left: any, right: any) => left.dayNo - right.dayNo);

  const items = (version.quote_items ?? []).map((item: any) => ({
    itemCategory: item.item_category,
    snapshotItemName: item.snapshot_item_name,
    snapshotSupplierName: item.snapshot_supplier_name ?? null,
    snapshotUnitCostAmount: Number(item.snapshot_unit_cost_amount ?? 0),
    quantity: Number(item.quantity ?? 0),
    paxCount: item.pax_count ?? null,
    totalCostKrw: Number(item.total_cost_krw ?? 0),
    totalSellAmount: Number(item.total_sell_amount ?? 0)
  }));

  const quoteCase = {
    caseCode: version.quote_cases?.case_code ?? null,
    tourName: version.quote_cases?.tour_name ?? null,
    currency: version.quote_cases?.currency ?? null
  };
  const normalizedVersion = {
    versionNo: version.version_no,
    status: version.status,
    currency: version.currency,
    publicTotalAmount: Number(version.public_total_amount ?? 0),
    itineraryDays,
    items
  };

  return {
    summary: buildQuoteExportSnapshotSummary({ quoteCase, version: normalizedVersion }),
    itineraryDays,
    items
  };
}

async function updateExport(supabase: any, id: string, patch: Record<string, unknown>) {
  const { data, error } = await supabase
    .from("quote_exports")
    .update(patch)
    .eq("id", id)
    .select("id, quote_version_id, storage_path, status, error_message, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
