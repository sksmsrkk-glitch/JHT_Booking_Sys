/*
 * 최종 견적서 + 오퍼레이터 확정 내용을 인보이스 초안으로 변환하는 모듈입니다.
 *
 * 업무 흐름:
 * 1. 파트너가 견적을 수락하면 quoteVersion이 accepted 상태가 됩니다.
 * 2. 내부 오퍼레이터가 호텔명, 룸타입, 식사, 관광지, 항공, 특이사항을 최종 확정합니다.
 * 3. 확정 스냅샷이 finalized 되면 이 함수가 인보이스 번호, 라인아이템,
 *    일정 스냅샷, 결제/계좌 정보를 자동 생성합니다.
 *
 * 주의:
 * - 인보이스는 최종 견적서와 운영 확정 내용을 기반으로 하며,
 *   Domestic Supplier 원가와 내부 마진은 파트너용 인보이스에 직접 노출하지 않습니다.
 * - tourCode는 inquiry/quotation/reservation/invoice/finance/report를 묶는
 *   공통 업무 코드이므로, 번호 생성 규칙을 바꿀 때는 전체 workflow를 함께 확인해야 합니다.
 */
type QuoteItemRow = {
  id: string;
  item_category: string;
  service_section?: string | null;
  snapshot_item_name: string;
  pricing_unit: string;
  quantity: number | string;
  pax_count?: number | null;
  total_sell_amount: number | string;
  partner_visible_notes?: string | null;
};

type ItineraryDayRow = {
  id: string;
  day_no: number;
  service_date: string | null;
  title: string | null;
  meal_summary: Record<string, unknown>;
  public_description: string | null;
};

type FinalOperationSnapshot = {
  day_snapshots?: Record<string, unknown>[];
  hotel_snapshot?: Record<string, unknown>[];
  meal_snapshot?: Record<string, unknown>[];
  flight_details?: Record<string, unknown>[];
  bank_account_snapshot?: Record<string, unknown>;
  operator_notes?: string | null;
};

export function buildInvoiceFromFinalQuote({
  reservation,
  quoteCase,
  quoteVersion,
  quoteItems,
  itineraryDays,
  finalSnapshot,
  versionNo
}: {
  reservation: Record<string, any>;
  quoteCase: Record<string, any>;
  quoteVersion: Record<string, any>;
  quoteItems: QuoteItemRow[];
  itineraryDays: ItineraryDayRow[];
  finalSnapshot: FinalOperationSnapshot | null;
  versionNo: number;
}) {
  const currency = quoteVersion.currency ?? quoteCase.currency ?? "KRW";
  // 견적 항목별 판매가를 인보이스 라인으로 변환합니다.
  // 화면에 보이는 인보이스 금액은 public total보다 라인아이템 합계를 우선합니다.
  const lineItems = quoteItems.map((item, index) => buildLineItem(item, index + 1, currency));
  const lineItemTotal = roundMoney(lineItems.reduce((sum, item) => sum + item.total_amount, 0));
  const publicTotal = roundMoney(Number(quoteVersion.public_total_amount ?? 0));
  const totalAmount = lineItemTotal > 0 ? lineItemTotal : publicTotal;
  // 하나의 단체는 문의부터 가이드 지출결의서까지 같은 업무 코드로 추적해야 하므로,
  // 인보이스 번호도 같은 tourCode를 접두어로 사용합니다.
  const tourCode = buildTourCode({
    caseCode: quoteCase.case_code,
    reservationCode: reservation.reservation_code,
    acceptedAt: quoteVersion.accepted_at,
    startDate: reservation.tour_start_date
  });

  return {
    invoice: {
      reservation_id: reservation.id,
      invoice_no: `${tourCode}-INV-v${versionNo}`,
      tour_code: tourCode,
      version_no: versionNo,
      // 운영 스냅샷에서 자동 생성되는 인보이스는 draft로 만들고, 발행(issued)은
      // 재무 롤이 별도 단계에서 승인하도록 남깁니다(고위험 액션 승인 게이트).
      status: "draft",
      currency,
      total_amount: totalAmount,
      issued_at: null,
      due_date: defaultDueDate(reservation.tour_start_date),
      payment_deadline: defaultDueDate(reservation.tour_start_date),
      collection_timing: "after_booking_confirmation",
      collection_status: "unpaid",
      deposit_required: false,
      deposit_amount: null,
      bank_account_snapshot: finalSnapshot?.bank_account_snapshot ?? {},
      flight_details: finalSnapshot?.flight_details ?? [],
      itinerary_snapshot: buildItinerarySnapshot(itineraryDays, finalSnapshot),
      invoice_payload: {
        source: "accepted_quote_and_final_operation_snapshot",
        quoteCaseId: quoteCase.id,
        quoteVersionId: quoteVersion.id,
        quoteVersionNo: quoteVersion.version_no,
        reservationCode: reservation.reservation_code,
        operatorNotes: finalSnapshot?.operator_notes ?? null,
        termsAndConditions: quoteVersion.terms_and_conditions ?? null,
        publicFareOptions: normalizeArray(quoteVersion.public_fare_options)
      }
    },
    lineItems
  };
}

function buildLineItem(item: QuoteItemRow, lineNo: number, fallbackCurrency: string) {
  const total = roundMoney(Number(item.total_sell_amount ?? 0));
  const quantity = Number(item.quantity ?? 1) || 1;
  return {
    line_no: lineNo,
    description: item.snapshot_item_name,
    service_date: null,
    category: item.service_section ?? item.item_category,
    currency: fallbackCurrency,
    unit_amount: roundMoney(quantity > 0 ? total / quantity : total),
    quantity,
    unit_label: item.pricing_unit,
    total_amount: total,
    notes: item.partner_visible_notes ?? null,
    metadata: {
      quoteItemId: item.id,
      paxCount: item.pax_count ?? null,
      itemCategory: item.item_category
    }
  };
}

function buildItinerarySnapshot(days: ItineraryDayRow[], finalSnapshot: FinalOperationSnapshot | null) {
  // 인보이스 일정은 파트너에게 최종 안내되는 문서이므로,
  // 오퍼레이터가 확정한 finalSnapshot 값이 있으면 quote itinerary보다 우선합니다.
  // finalSnapshot이 아직 없을 때만 기존 견적 일정 데이터를 fallback으로 사용합니다.
  const finalDays = Array.isArray(finalSnapshot?.day_snapshots) ? finalSnapshot.day_snapshots : [];
  const hotelByDay = indexByDay(finalSnapshot?.hotel_snapshot);
  const mealByDay = indexByDay(finalSnapshot?.meal_snapshot);

  if (finalDays.length > 0) {
    return finalDays.map((day, index) => ({
      day: day.day ?? day.dayNo ?? index + 1,
      date: day.date ?? day.serviceDate ?? null,
      title: day.title ?? null,
      hotel: day.hotel ?? hotelByDay.get(String(day.day ?? day.dayNo ?? index + 1))?.hotel ?? null,
      roomType: day.roomType ?? hotelByDay.get(String(day.day ?? day.dayNo ?? index + 1))?.roomType ?? null,
      meals: day.meals ?? mealByDay.get(String(day.day ?? day.dayNo ?? index + 1))?.meals ?? null,
      attractions: day.attractions ?? day.program ?? day.tourItems ?? [],
      description: day.description ?? day.publicDescription ?? null,
      specialNotes: day.specialNotes ?? day.notes ?? null
    }));
  }

  return days.map((day) => ({
    day: day.day_no,
    date: day.service_date,
    title: day.title,
    hotel: hotelByDay.get(String(day.day_no))?.hotel ?? day.meal_summary?.hotel ?? null,
    roomType: hotelByDay.get(String(day.day_no))?.roomType ?? null,
    meals: mealByDay.get(String(day.day_no))?.meals ?? day.meal_summary,
    attractions: [],
    description: day.public_description,
    specialNotes: null
  }));
}

function indexByDay(rows: unknown) {
  const map = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const value = row as Record<string, unknown>;
    const day = value.day ?? value.dayNo ?? value.day_no;
    if (day !== undefined && day !== null) map.set(String(day), value);
  }
  return map;
}

function buildTourCode({
  caseCode,
  reservationCode,
  acceptedAt,
  startDate
}: {
  caseCode?: string | null;
  reservationCode?: string | null;
  acceptedAt?: string | null;
  startDate?: string | null;
}) {
  // caseCode/reservationCode/날짜를 결합해 외부 문서에서도 추적 가능한 코드를 만듭니다.
  // 특수문자는 제거해서 파일명, 엑셀 출력, 인보이스 번호에 안전하게 사용합니다.
  const date = String(acceptedAt ?? startDate ?? new Date().toISOString()).slice(0, 10).replaceAll("-", "");
  return [caseCode, reservationCode, date].filter(Boolean).join("-").replace(/[^A-Z0-9-]/gi, "").toUpperCase();
}

function defaultDueDate(tourStartDate: string | null | undefined) {
  // 기본 수금기한은 투어 시작 14일 전입니다.
  // 실제 입금 조건은 파트너/단체별로 다를 수 있으므로 invoice payload에서 조정 가능합니다.
  if (!tourStartDate) return null;
  const date = new Date(`${tourStartDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 14);
  return date.toISOString().slice(0, 10);
}

function normalizeArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
