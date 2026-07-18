"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { useMemo, useState } from "react";
import { summarizeGuideExpenseReport } from "@/lib/domain/guide-expenses.mjs";

/*
 * 가이드 지출결의서 입력 화면입니다.
 *
 * PMB 인센티브 엑셀에서 쓰던 실제 지출 항목을 시스템에 직접 입력하기 위한 폼입니다.
 * Report No는 사용자가 임의로 새 번호를 만드는 값이 아니라, 단체의 공통 workflow code
 * (inquiry/quotation/reservation/invoice/finance/guide expense 공통 코드)를 그대로 사용합니다.
 */
type GuideExpenseLine = {
  id?: string | null;
  lineNo: number;
  section: string;
  expenseDate: string;
  dayNo: string;
  vendorName: string;
  description: string;
  unitAmount: string;
  quantity: string;
  paxCount: string;
  totalAmount: string;
  paymentMethod: string;
  notes: string;
};

type InitialReport = {
  reportNo?: string | null;
  status?: string | null;
  guideName?: string | null;
  guidePhone?: string | null;
  tourLeaderName?: string | null;
  groupTitle?: string | null;
  paxCount?: number | null;
  tourStartDate?: string | null;
  tourEndDate?: string | null;
  currency?: string | null;
  cashAdvanceAmount?: number | null;
  internalNotes?: string | null;
  lines?: GuideExpenseLine[];
};

const sectionLabels: Record<string, string> = {
  lodging: "숙박비",
  meal: "식음료비",
  ticket: "입장료",
  cash_expense: "기타경비 / 가이드 현금사용",
  guide_fee: "가이드 일비 / 팁",
  shopping: "쇼핑 수수료",
  other: "기타"
};

const sectionOptions = Object.entries(sectionLabels);

export function GuideExpenseReportForm({
  reservationId,
  initialReport,
  previewMode = false
}: {
  reservationId: string;
  initialReport: InitialReport;
  previewMode?: boolean;
}) {
  const [report, setReport] = useState({
    reportNo: initialReport.reportNo ?? "",
    guideName: initialReport.guideName ?? "",
    guidePhone: initialReport.guidePhone ?? "",
    tourLeaderName: initialReport.tourLeaderName ?? "",
    groupTitle: initialReport.groupTitle ?? "",
    paxCount: String(initialReport.paxCount ?? ""),
    tourStartDate: initialReport.tourStartDate ?? "",
    tourEndDate: initialReport.tourEndDate ?? "",
    currency: initialReport.currency ?? "KRW",
    cashAdvanceAmount: String(initialReport.cashAdvanceAmount ?? 0),
    internalNotes: initialReport.internalNotes ?? ""
  });
  const [lines, setLines] = useState<GuideExpenseLine[]>(
    initialReport.lines && initialReport.lines.length > 0 ? initialReport.lines : buildPmbSampleLines()
  );
  const [status, setStatus] = useState(initialReport.status ?? "draft");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const summary = useMemo(
    // 입력 중에도 섹션별 합계, 총 실비, 정산 차액이 즉시 갱신됩니다.
    // 실제 저장 API에서도 같은 summarizeGuideExpenseReport 함수를 사용해 계산 차이를 막습니다.
    () => summarizeGuideExpenseReport(lines, Number(report.cashAdvanceAmount || 0)),
    [lines, report.cashAdvanceAmount]
  );

  function updateReport(field: keyof typeof report, value: string) {
    setReport((current) => ({ ...current, [field]: value }));
  }

  function updateLine(index: number, field: keyof GuideExpenseLine, value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === "unitAmount" || field === "quantity") {
          // PMB 엑셀처럼 단가나 수량을 바꾸면 합계를 자동 계산합니다.
          // totalAmount는 별도 입력도 가능하므로 현장 예외 비용은 수동 보정할 수 있습니다.
          const amount = Number(String(next.unitAmount).replace(/,/g, "")) * Number(String(next.quantity).replace(/,/g, ""));
          if (Number.isFinite(amount)) next.totalAmount = String(Math.round(amount));
        }
        return next;
      })
    );
  }

  function addLine(section: string) {
    setLines((current) => [
      ...current,
      {
        lineNo: current.length + 1,
        section,
        expenseDate: "",
        dayNo: "",
        vendorName: "",
        description: "",
        unitAmount: "0",
        quantity: "1",
        paxCount: report.paxCount,
        totalAmount: "0",
        paymentMethod: "cash",
        notes: ""
      }
    ]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index).map((line, lineIndex) => ({ ...line, lineNo: lineIndex + 1 })));
  }

  async function save(nextStatus: string) {
    setIsSaving(true);
    setMessage("");
    const payload = {
      ...report,
      paxCount: report.paxCount ? Number(report.paxCount) : null,
      cashAdvanceAmount: Number(report.cashAdvanceAmount || 0),
      status: nextStatus,
      lines,
      sourceWorkbookSummary: {
        // 나중에 실제 엑셀 업로드 기능과 연결할 때 어떤 구조를 기준으로 삼았는지 남겨둡니다.
        source: "PMB 인센티브.xlsx",
        analyzedSections: Object.values(sectionLabels),
        formulaPatterns: ["SUM(section rows)", "unit amount x quantity", "manual total override"]
      }
    };

    if (previewMode) {
      // 개발/시연 모드에서는 Supabase 로그인 없이도 화면 흐름을 확인할 수 있게 DB 저장을 생략합니다.
      setStatus(nextStatus);
      setMessage(nextStatus === "submitted" ? "Preview submitted. Real DB sync will run after login/Supabase setup." : "Preview draft saved.");
      setIsSaving(false);
      return;
    }

    const response = await safeFetch(`/api/reservations/${reservationId}/guide-expense-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setIsSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? "Save failed");
      return;
    }
    setStatus(result.data.report.status);
    setMessage(`Saved ${result.data.lines.length} lines. Finance expenses synced: ${result.data.syncedExpenseCount}.`);
  }

  return (
    <section className="panel-section guide-expense-form">
      <div className="section-heading">
        <div>
          <h2>Guide Expense Report</h2>
          <p>PMB 지출결의서 구조를 기준으로 실제 지출, 가이드 일비, 쇼핑 수수료를 입력합니다.</p>
        </div>
        <span className={`status-dot status-${status}`}>{status}</span>
      </div>

      {message ? <section className="notice compact">{message}</section> : null}

      <div className="form-grid guide-expense-overview">
        <label className="guide-expense-code-field">
          Workflow Code / Report No
          <input readOnly value={report.reportNo} placeholder="Inquiry / quotation / reservation code" />
          <span className="subtext">Linked to inquiry, quotation, confirmation, invoice, finance, and guide expense records.</span>
        </label>
        <label className="guide-expense-title-field">
          Group Title
          <input value={report.groupTitle} onChange={(event) => updateReport("groupTitle", event.target.value)} />
        </label>
        <label>
          Guide
          <input value={report.guideName} onChange={(event) => updateReport("guideName", event.target.value)} />
        </label>
        <label>
          Guide Phone
          <input value={report.guidePhone} onChange={(event) => updateReport("guidePhone", event.target.value)} />
        </label>
        <label>
          Tour Leader
          <input value={report.tourLeaderName} onChange={(event) => updateReport("tourLeaderName", event.target.value)} />
        </label>
        <label>
          Pax
          <input type="number" value={report.paxCount} onChange={(event) => updateReport("paxCount", event.target.value)} />
        </label>
        <label>
          Start
          <input type="date" value={report.tourStartDate} onChange={(event) => updateReport("tourStartDate", event.target.value)} />
        </label>
        <label>
          End
          <input type="date" value={report.tourEndDate} onChange={(event) => updateReport("tourEndDate", event.target.value)} />
        </label>
        <label>
          Currency
          <input value={report.currency} onChange={(event) => updateReport("currency", event.target.value.toUpperCase())} />
        </label>
        <label>
          Cash Advance
          <input type="number" value={report.cashAdvanceAmount} onChange={(event) => updateReport("cashAdvanceAmount", event.target.value)} />
        </label>
      </div>

      <section className="metric-row guide-expense-metrics">
        <Metric label="숙박비" value={summary.sectionTotals.lodging} currency={report.currency} />
        <Metric label="식음료비" value={summary.sectionTotals.meal} currency={report.currency} />
        <Metric label="입장료" value={summary.sectionTotals.ticket} currency={report.currency} />
        <Metric label="기타 현금" value={summary.sectionTotals.cash_expense} currency={report.currency} />
        <Metric label="가이드" value={summary.sectionTotals.guide_fee} currency={report.currency} />
        <Metric label="총 실비" value={summary.totalAmount} currency={report.currency} />
        <Metric label="정산 차액" value={summary.settlementAmount} currency={report.currency} />
      </section>

      {sectionOptions.map(([section, label]) => (
        <section className="section-block" key={section}>
          <div className="section-heading">
            <h3>{label}</h3>
            <button className="button-secondary" type="button" onClick={() => addLine(section)}>
              Add Row
            </button>
          </div>
          <section className="table-shell nested" aria-label={`${label} expense rows`}>
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>DAY</th>
                  <th>지출처</th>
                  <th>내역</th>
                  <th>단가</th>
                  <th>수량/일수</th>
                  <th>인원</th>
                  <th>합계</th>
                  <th>지급</th>
                  <th>비고</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines
                  .map((line, index) => ({ line, index }))
                  .filter(({ line }) => line.section === section)
                  .map(({ line, index }) => (
                    <tr key={`${section}-${index}`}>
                      <td><input type="date" value={line.expenseDate} onChange={(event) => updateLine(index, "expenseDate", event.target.value)} /></td>
                      <td><input type="number" value={line.dayNo} onChange={(event) => updateLine(index, "dayNo", event.target.value)} /></td>
                      <td><input value={line.vendorName} onChange={(event) => updateLine(index, "vendorName", event.target.value)} /></td>
                      <td><input value={line.description} onChange={(event) => updateLine(index, "description", event.target.value)} /></td>
                      <td><input type="number" value={line.unitAmount} onChange={(event) => updateLine(index, "unitAmount", event.target.value)} /></td>
                      <td><input type="number" value={line.quantity} onChange={(event) => updateLine(index, "quantity", event.target.value)} /></td>
                      <td><input type="number" value={line.paxCount} onChange={(event) => updateLine(index, "paxCount", event.target.value)} /></td>
                      <td><input type="number" value={line.totalAmount} onChange={(event) => updateLine(index, "totalAmount", event.target.value)} /></td>
                      <td>
                        <select value={line.paymentMethod} onChange={(event) => updateLine(index, "paymentMethod", event.target.value)}>
                          <option value="cash">현금</option>
                          <option value="company_card">법인카드</option>
                          <option value="bank_transfer">계좌이체</option>
                          <option value="onsite_collected">현장수령</option>
                          <option value="unpaid">후불</option>
                        </select>
                      </td>
                      <td><input value={line.notes} onChange={(event) => updateLine(index, "notes", event.target.value)} /></td>
                      <td><button className="button-secondary" type="button" onClick={() => removeLine(index)}>Remove</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </section>
      ))}

        <label className="guide-expense-notes-field">
        Internal Notes
        <textarea value={report.internalNotes} onChange={(event) => updateReport("internalNotes", event.target.value)} rows={3} />
      </label>

      <div className="inline-actions">
        <button className="button-secondary" type="button" disabled={isSaving} onClick={() => save("draft")}>
          Save Draft
        </button>
        <button type="button" disabled={isSaving} onClick={() => save("submitted")}>
          Submit & Sync Actual Costs
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{currency} {value.toLocaleString()}</strong>
    </article>
  );
}

function buildPmbSampleLines(): GuideExpenseLine[] {
  // 첨부된 PMB 지출결의서에서 확인한 대표 항목을 더미 데이터로 넣어
  // 화면을 처음 열었을 때 숙박/식사/입장료/현금/가이드 비용 구조를 바로 볼 수 있게 합니다.
  const rows = [
    ["meal", "2025-05-21", "1", "울산청해횟집", "중식", "23000", "30", "30", "690000", "company_card", "PMB B3 sample"],
    ["meal", "2025-05-23", "3", "대게만찬", "석식", "87000", "30", "30", "2610000", "company_card", ""],
    ["ticket", "2025-05-21", "1", "블루라인", "해운대 블루라인", "12000", "30", "30", "360000", "cash", ""],
    ["ticket", "2025-05-23", "3", "송도케이블", "송도해상케이블카", "16533", "30", "30", "496000", "cash", ""],
    ["cash_expense", "2025-05-22", "2", "부산 기사", "기사일비", "190000", "1", "", "190000", "cash", "부산기사님"],
    ["cash_expense", "2025-05-25", "5", "KTX", "부산 티켓", "68300", "1", "", "68300", "cash", ""],
    ["guide_fee", "2025-05-21", "1", "가이드", "가이드 일비", "200000", "5", "", "1000000", "cash", ""],
    ["guide_fee", "2025-05-21", "1", "가이드", "가이드 팁", "8000", "5", "30", "0", "onsite_collected", "현장수령"]
  ];
  return rows.map((row, index) => ({
    lineNo: index + 1,
    section: row[0],
    expenseDate: row[1],
    dayNo: row[2],
    vendorName: row[3],
    description: row[4],
    unitAmount: row[5],
    quantity: row[6],
    paxCount: row[7],
    totalAmount: row[8],
    paymentMethod: row[9],
    notes: row[10]
  }));
}
