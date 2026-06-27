import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson, requireString, requireUuid } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { SUPPLIER_CATEGORIES, listDomesticSuppliers } from "@/features/supplier/queries";

export async function GET(request: Request) {
  try {
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const url = new URL(request.url);
    const suppliers = await listDomesticSuppliers(supabase, {
      q: url.searchParams.get("q") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      status: url.searchParams.get("status") ?? undefined
    });

    return ok(suppliers);
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid input value for enum")) {
      return fail(new HttpError(400, "Invalid supplier filter"));
    }
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson<Record<string, unknown>>(request);
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const category = requireString(body.category, "category");
    if (!SUPPLIER_CATEGORIES.includes(category as any)) {
      throw new HttpError(400, "Invalid supplier category");
    }

    const { data, error } = await supabase
      .from("domestic_suppliers")
      .insert({
        company_id: requireUuid(body.companyId, "companyId"),
        category,
        name_ko: requireString(body.nameKo, "nameKo"),
        name_en: optionalString(body.nameEn),
        search_keywords: optionalString(body.searchKeywords),
        region_level1: optionalString(body.regionLevel1),
        region_level2: optionalString(body.regionLevel2),
        address: optionalString(body.address),
        phone: optionalString(body.phone),
        website: optionalString(body.website),
        internal_notes: optionalString(body.internalNotes),
        status: "active"
      })
      .select("id, category, name_ko, status")
      .single();

    if (error) throw new HttpError(500, error.message);

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: "domestic_supplier.created",
      entityTable: "domestic_suppliers",
      entityId: data.id,
      afterData: data
    });

    return created(data);
  } catch (error) {
    return fail(error);
  }
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return String(value);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
