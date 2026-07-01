import {
  buildFinanceExpenseRowsFromGuideReport,
  summarizeGuideExpenseReport
} from "@/lib/domain/guide-expenses.mjs";
import { requireInternalUser } from "@/lib/api/auth";
import { writeAuditLog } from "@/lib/api/audit";
import { created, fail, HttpError, ok, readJson } from "@/lib/api/http";
import { createRequestSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

/*
 * 가이드 지출결의서 저장 API입니다.
 *
 * 가이드가 투어 종료 후 입력한 실제 지출은 인보이스 매출과 함께
 * 단체별 손익 분석의 핵심 데이터입니다. draft는 임시 저장, submitted는
 * 회계 expenses로 동기화되는 상태로 다룹니다.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    await requireInternalUser(supabase);

    const { data: report, error } = await supabase
      .from("guide_expense_reports")
      .select("*, guide_expense_report_lines(*)")
      .eq("reservation_id", id)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    return ok(report ?? null);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = createRequestSupabaseClient(request);
    const internalUser = await requireInternalUser(supabase);
    const body = await readJson<Record<string, unknown>>(request);
    const status = ["draft", "submitted", "approved", "rejected"].includes(String(body.status))
      ? String(body.status)
      : "draft";
    const linesInput = Array.isArray(body.lines) ? body.lines : [];
    const cashAdvanceAmount = numberValue(body.cashAdvanceAmount);
    // 화면에서 받은 라인들을 PMB 엑셀 기준 섹션별 합계로 정규화합니다.
    // 선지급금은 총 실비에서 차감해 정산 차액을 계산합니다.
    const summary = summarizeGuideExpenseReport(linesInput, cashAdvanceAmount);
    const reportNo = await buildReportNo(supabase, id, body.reportNo);

    const { data: report, error: reportError } = await supabase
      .from("guide_expense_reports")
      .upsert(
        {
          reservation_id: id,
          invoice_id: optionalString(body.invoiceId),
          report_no: reportNo,
          status,
          guide_name: optionalString(body.guideName),
          guide_phone: optionalString(body.guidePhone),
          tour_leader_name: optionalString(body.tourLeaderName),
          group_title: optionalString(body.groupTitle),
          pax_count: optionalInteger(body.paxCount),
          tour_start_date: optionalString(body.tourStartDate),
          tour_end_date: optionalString(body.tourEndDate),
          currency: optionalString(body.currency) ?? "KRW",
          cash_advance_amount: cashAdvanceAmount,
          total_lodging_amount: summary.sectionTotals.lodging,
          total_meal_amount: summary.sectionTotals.meal,
          total_ticket_amount: summary.sectionTotals.ticket,
          total_cash_expense_amount: summary.sectionTotals.cash_expense,
          total_guide_fee_amount: summary.sectionTotals.guide_fee,
          total_shopping_commission_amount: summary.sectionTotals.shopping,
          total_amount: summary.totalAmount,
          settlement_amount: summary.settlementAmount,
          source_workbook_summary: normalizeObject(body.sourceWorkbookSummary),
          internal_notes: optionalString(body.internalNotes),
          submitted_at: status === "submitted" ? new Date().toISOString() : null,
          updated_by: internalUser.profileId,
          created_by: internalUser.profileId
        },
        { onConflict: "reservation_id" }
      )
      .select("*")
      .single();

    if (reportError) throw new HttpError(500, reportError.message);

    const { error: deleteError } = await supabase.from("guide_expense_report_lines").delete().eq("report_id", report.id);
    if (deleteError) throw new HttpError(500, deleteError.message);

    let savedLines: any[] = [];
    if (summary.lines.length > 0) {
      const { data: lineRows, error: lineError } = await supabase
        .from("guide_expense_report_lines")
        .insert(
          summary.lines.map((line: any) => ({
            report_id: report.id,
            reservation_id: id,
            line_no: line.lineNo,
            section: line.section,
            expense_date: line.expenseDate,
            day_no: line.dayNo,
            vendor_name: line.vendorName,
            description: line.description,
            unit_amount: line.unitAmount,
            quantity: line.quantity,
            pax_count: line.paxCount,
            total_amount: line.totalAmount,
            payment_method: line.paymentMethod,
            receipt_storage_path: line.receiptStoragePath,
            notes: line.notes,
            source_sheet_name: line.sourceSheetName,
            source_sheet_row: line.sourceSheetRow
          }))
        )
        .select("*")
        .order("line_no", { ascending: true });
      if (lineError) throw new HttpError(500, lineError.message);
      savedLines = lineRows ?? [];
    }

    let syncedExpenseCount = 0;
    if (status === "submitted") {
      // submitted 상태가 되면 실제 비용으로 인정하고 finance expenses에 반영합니다.
      // draft 상태에서는 회계 원장에 영향을 주지 않습니다.
      syncedExpenseCount = await syncSubmittedLinesToFinanceExpenses(supabase, report, savedLines, internalUser.profileId);
    }

    await writeAuditLog(supabase, {
      actorProfileId: internalUser.profileId,
      action: status === "submitted" ? "guide_expense_report.submitted" : "guide_expense_report.saved",
      entityTable: "guide_expense_reports",
      entityId: report.id,
      riskLevel: "high",
      afterData: { report, lineCount: savedLines.length, syncedExpenseCount }
    });

    return created({ report, lines: savedLines, syncedExpenseCount });
  } catch (error) {
    return fail(error);
  }
}

async function syncSubmittedLinesToFinanceExpenses(
  supabase: any,
  report: Record<string, unknown>,
  lines: Record<string, unknown>[],
  actorProfileId: string
) {
  // 지출결의서 라인을 회계 비용 row로 바꿉니다.
  // upsert 키는 source_guide_expense_report_line_id라서 재제출해도 중복 비용이 쌓이지 않습니다.
  const expenseRows = buildFinanceExpenseRowsFromGuideReport(
    {
      reservationId: report.reservation_id,
      currency: report.currency,
      actorProfileId
    },
    lines.map((line) => ({
      id: line.id,
      section: line.section,
      expenseDate: line.expense_date,
      vendorName: line.vendor_name,
      description: line.description,
      totalAmount: line.total_amount,
      receiptStoragePath: line.receipt_storage_path
    }))
  );

  if (expenseRows.length === 0) return 0;
  const { error } = await supabase
    .from("expenses")
    .upsert(expenseRows, { onConflict: "source_guide_expense_report_line_id" });
  if (error) throw new HttpError(500, error.message);
  return expenseRows.length;
}

async function buildReportNo(supabase: any, reservationId: string, provided: unknown) {
  // report no는 별도 번호가 아니라 단체의 공통 workflow code를 따릅니다.
  // 즉 inquiry/quotation/reservation/invoice/finance/guide expense가 같은 코드로 검색됩니다.
  const { data } = await supabase
    .from("reservations")
    .select("reservation_code, quote_cases(case_code)")
    .eq("id", reservationId)
    .maybeSingle();

  const quoteCase = Array.isArray(data?.quote_cases) ? data?.quote_cases[0] : data?.quote_cases;
  const canonical = optionalString(quoteCase?.case_code) ?? optionalString(data?.reservation_code);
  return String(canonical ?? optionalString(provided) ?? reservationId)
    .replace(/[^A-Za-z0-9-]/g, "-")
    .toUpperCase();
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim() || null;
}

function optionalInteger(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function numberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}
