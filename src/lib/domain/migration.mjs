export const MIGRATION_STATUSES = ["uploaded", "mapped", "validated", "approved", "imported", "failed"];

export const MIGRATION_REQUIRED_FIELDS = {
  agency_accounts: ["name"],
  agency_contacts: ["agency_account_id", "name"],
  domestic_suppliers: ["company_id", "category", "name_ko"],
  supplier_contacts: ["domestic_supplier_id", "name"],
  supplier_products: ["domestic_supplier_id", "product_type", "name_ko", "search_name"],
  supplier_prices: ["supplier_product_id", "pricing_unit", "currency", "cost_amount"],
  supplier_media: ["media_type", "storage_path"]
};

const MIGRATION_TRANSITIONS = {
  uploaded: ["validated", "failed"],
  mapped: ["validated", "failed"],
  validated: ["approved", "failed"],
  approved: ["imported", "failed"],
  imported: [],
  failed: ["validated", "failed"]
};

export function validateMigrationRows({ targetTable, rows }) {
  const requiredFields = MIGRATION_REQUIRED_FIELDS[targetTable];
  if (!requiredFields) {
    throw new Error(`Unsupported migration target table: ${targetTable}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Migration batch must include at least one staging row");
  }

  const validatedRows = rows.map((row) => {
    const payload = normalizePayload(row.rawPayload ?? row.raw_payload);
    const missingFields = requiredFields.filter((field) => isBlank(payload[field]));
    return {
      id: row.id,
      rowNo: Number(row.rowNo ?? row.row_no),
      mappedPayload: payload,
      validationStatus: missingFields.length > 0 ? "invalid" : "valid",
      errors: missingFields.map((field) => ({
        stagingRowId: row.id,
        rowNo: Number(row.rowNo ?? row.row_no),
        errorCode: "missing_required_field",
        errorMessage: `${field} is required for ${targetTable}`
      }))
    };
  });

  const errors = validatedRows.flatMap((row) => row.errors);
  return {
    status: errors.length > 0 ? "failed" : "validated",
    rowCount: validatedRows.length,
    validRowCount: validatedRows.filter((row) => row.validationStatus === "valid").length,
    errorCount: errors.length,
    rows: validatedRows,
    errors
  };
}

export function buildMigrationStatusUpdate({ currentStatus, nextStatus, actorProfileId }, now = new Date()) {
  assertStatus(currentStatus, "currentStatus");
  assertStatus(nextStatus, "nextStatus");
  if (!actorProfileId) {
    throw new Error("actorProfileId is required");
  }

  const allowedNextStatuses = MIGRATION_TRANSITIONS[currentStatus] ?? [];
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new Error(`Migration batch cannot move from ${currentStatus} to ${nextStatus}`);
  }

  return {
    status: nextStatus,
    audit: {
      actorProfileId,
      action: `notion_csv.${nextStatus}`,
      riskLevel: nextStatus === "approved" || nextStatus === "imported" ? "high" : nextStatus === "failed" ? "normal" : "normal",
      approvalData:
        nextStatus === "approved" || nextStatus === "imported"
          ? { approvedBy: actorProfileId, approvedAt: now.toISOString() }
          : null
    }
  };
}

export function buildMigrationImportRows({ targetTable, rows }) {
  const requiredFields = MIGRATION_REQUIRED_FIELDS[targetTable];
  if (!requiredFields) {
    throw new Error(`Unsupported migration target table: ${targetTable}`);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Migration import requires at least one valid staging row");
  }

  return rows.map((row) => {
    if (row.validationStatus !== "valid" && row.validation_status !== "valid") {
      throw new Error(`Staging row ${row.rowNo ?? row.row_no ?? row.id} is not valid`);
    }
    const payload = normalizePayload(row.mappedPayload ?? row.mapped_payload);
    const missingFields = requiredFields.filter((field) => isBlank(payload[field]));
    if (missingFields.length > 0) {
      throw new Error(`Staging row ${row.rowNo ?? row.row_no ?? row.id} is missing ${missingFields.join(", ")}`);
    }
    return payload;
  });
}

function normalizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload;
}

function isBlank(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function assertStatus(status, field) {
  if (!MIGRATION_STATUSES.includes(status)) {
    throw new Error(`Unsupported ${field}: ${status}`);
  }
}
