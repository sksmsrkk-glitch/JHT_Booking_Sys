/**
 * @file 한글 책임: `Invoice Document` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
type InvoicePayment = {
  id: string;
  status: string;
  currency: string;
  amount: number;
  receivedAt: string | null;
  method: string | null;
  referenceNo?: string | null;
};

type InvoiceLineItem = {
  id: string;
  lineNo: number;
  description: string;
  serviceDate: string | null;
  category: string | null;
  currency: string;
  unitAmount: number;
  quantity: number;
  unitLabel: string | null;
  totalAmount: number;
  notes: string | null;
};

type InvoiceItineraryDay = {
  day: number | string;
  date?: string | null;
  title?: string | null;
  hotel?: string | null;
  meals?: Record<string, unknown> | string[] | string | null;
  attractions?: unknown;
  description?: string | null;
  specialNotes?: string | null;
  remarks?: string | null;
};

/**
 * 발행 버전의 청구 라인·입금·잔액과 최종 운영 일정 스냅샷을 파트너용 인보이스 문서로 렌더링합니다.
 * 금액은 인보이스 통화로만 표시하고 내부 원가나 마진 정보는 문서 모델에 포함하지 않습니다.
 */
export function InvoiceDocument({
  invoice,
  billTo,
  remainingAmount,
  title = "Invoice"
}: {
  invoice: {
    invoiceNo: string;
    tourCode?: string | null;
    versionNo?: number;
    reservationCode: string | null;
    reservationId: string;
    tourName: string | null;
    status: string;
    currency: string;
    totalAmount: number;
    issuedAt: string | null;
    dueDate: string | null;
    paymentDeadline?: string | null;
    collectionTiming?: string | null;
    collectionStatus?: string;
    depositRequired?: boolean;
    depositAmount?: number | null;
    confirmedPaymentTotal: number;
    payments: InvoicePayment[];
    lineItems?: InvoiceLineItem[];
    bankAccountSnapshot?: Record<string, unknown>;
    flightDetails?: Record<string, unknown>[];
    itinerarySnapshot?: Record<string, unknown>[];
  };
  billTo: string | null;
  remainingAmount: number;
  title?: string;
}) {
  const lineItems =
    invoice.lineItems && invoice.lineItems.length > 0
      ? invoice.lineItems
      : [
          {
            id: "summary",
            lineNo: 1,
            description: invoice.tourName ?? "Inbound travel service package",
            serviceDate: null,
            category: "package",
            currency: invoice.currency,
            unitAmount: invoice.totalAmount,
            quantity: 1,
            unitLabel: "group",
            totalAmount: invoice.totalAmount,
            notes: null
          }
        ];
  const bank = invoice.bankAccountSnapshot ?? {};
  const itineraryDays = (invoice.itinerarySnapshot ?? [])
    .map(mapItineraryDay)
    .filter((day): day is InvoiceItineraryDay => day !== null);

  return (
    <section className="invoice-document" aria-label={`${title} ${invoice.invoiceNo}`}>
      <div className="invoice-document-header">
        <div>
          <p className="eyebrow">Jungho Travel</p>
          <h2>{title}</h2>
          <p>
            {invoice.invoiceNo}
            {invoice.versionNo ? ` / Version ${invoice.versionNo}` : ""}
          </p>
        </div>
        <span className={`status-dot status-${invoice.status}`}>{formatLabel(invoice.status)}</span>
      </div>

      <dl className="definition-list columns">
        <div>
          <dt>Bill To</dt>
          <dd>{billTo ?? "Agency not set"}</dd>
        </div>
        <div>
          <dt>Reservation</dt>
          <dd>{invoice.reservationCode ?? invoice.reservationId}</dd>
        </div>
        <div>
          <dt>Tour Code</dt>
          <dd>{invoice.tourCode ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{invoice.issuedAt ? formatDateTime(invoice.issuedAt) : "Not issued"}</dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>{invoice.paymentDeadline ?? invoice.dueDate ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Collection</dt>
          <dd>{formatLabel(invoice.collectionStatus ?? invoice.status)}</dd>
        </div>
        <div>
          <dt>Payment Timing</dt>
          <dd>{invoice.collectionTiming ? formatLabel(invoice.collectionTiming) : "Not set"}</dd>
        </div>
      </dl>

      <section className="invoice-line-items">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Currency</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              <tr key={item.id}>
                <td>{item.lineNo}</td>
                <td>
                  <strong>{item.description}</strong>
                  <span className="subtext">
                    {[item.serviceDate, item.category, item.notes].filter(Boolean).join(" / ")}
                  </span>
                </td>
                <td>{formatMoney(item.quantity)}</td>
                <td>{item.unitLabel ?? formatMoney(item.unitAmount)}</td>
                <td>{item.currency}</td>
                <td>{formatMoney(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <dl className="invoice-totals">
        <div>
          <dt>Total</dt>
          <dd>
            {invoice.currency} {formatMoney(invoice.totalAmount)}
          </dd>
        </div>
        <div>
          <dt>Confirmed Paid</dt>
          <dd>
            {invoice.currency} {formatMoney(invoice.confirmedPaymentTotal)}
          </dd>
        </div>
        <div>
          <dt>Balance Due</dt>
          <dd>
            {invoice.currency} {formatMoney(remainingAmount)}
          </dd>
        </div>
        {invoice.depositRequired ? (
          <div>
            <dt>Deposit</dt>
            <dd>
              {invoice.currency} {formatMoney(invoice.depositAmount ?? 0)}
            </dd>
          </div>
        ) : null}
      </dl>

      {itineraryDays.length > 0 ? (
        <section className="invoice-itinerary">
          <div className="invoice-section-title">
            <h3>Confirmed Itinerary</h3>
            <p>Final confirmed quote schedule included for hotel, meals, attractions, and special notes.</p>
          </div>
          <div className="invoice-itinerary-list">
            {itineraryDays.map((day) => (
              <article className="invoice-itinerary-day" key={`${String(day.day)}-${day.date ?? day.title ?? ""}`}>
                <div className="invoice-itinerary-day-heading">
                  <span>Day {day.day}</span>
                  <strong>{day.title ?? "Confirmed schedule"}</strong>
                  {day.date ? <em>{day.date}</em> : null}
                </div>
                {day.description ? <p>{day.description}</p> : null}
                <dl className="definition-list columns compact">
                  <div>
                    <dt>Hotel</dt>
                    <dd>{day.hotel ?? "Not included"}</dd>
                  </div>
                  <div>
                    <dt>Meals</dt>
                    <dd>{formatMeals(day.meals)}</dd>
                  </div>
                  <div>
                    <dt>Attractions / Program</dt>
                    <dd>{formatAttractions(day.attractions)}</dd>
                  </div>
                  <div>
                    <dt>Special Notes</dt>
                    <dd>{day.specialNotes ?? day.remarks ?? "None"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {invoice.flightDetails && invoice.flightDetails.length > 0 ? (
        <section className="invoice-payment-note">
          <h3>Flight Details</h3>
          <ul className="clean-list">
            {invoice.flightDetails.map((flight, index) => (
              <li key={`${String(flight.flightNo ?? index)}-${index}`}>
                {[flight.type, flight.flightNo, flight.date, flight.time, flight.route].filter(Boolean).join(" / ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {Object.keys(bank).length > 0 ? (
        <section className="invoice-payment-note">
          <h3>Bank / Payment</h3>
          <dl className="definition-list columns">
            {Object.entries(bank).map(([key, value]) => (
              <div key={key}>
                <dt>{formatLabel(key)}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {invoice.payments.length > 0 ? (
        <section className="invoice-payment-note">
          <h3>Payment Records</h3>
          <ul className="clean-list">
            {invoice.payments.map((payment) => (
              <li key={payment.id}>
                {formatLabel(payment.status)} / {payment.currency} {formatMoney(payment.amount)}
                {payment.receivedAt ? ` / ${formatDateTime(payment.receivedAt)}` : ""}
                {payment.referenceNo ? ` / ${payment.referenceNo}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString();
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

/** JSONB 일정 행을 문서가 허용하는 필드로 좁히며 필수 Day 값이 없는 행은 출력에서 제외합니다. */
function mapItineraryDay(value: Record<string, unknown>): InvoiceItineraryDay | null {
  const day = value.day ?? value.dayNo ?? value.day_no;
  if (day === undefined || day === null) return null;
  return {
    day: String(day),
    date: stringValue(value.date ?? value.serviceDate ?? value.service_date),
    title: stringValue(value.title),
    hotel: stringValue(value.hotel ?? value.hotelName ?? value.hotel_name),
    meals: (value.meals ?? value.mealSummary ?? value.meal_summary) as InvoiceItineraryDay["meals"],
    attractions: value.attractions ?? value.program ?? value.visits ?? value.tourItems,
    description: stringValue(value.description ?? value.publicDescription ?? value.public_description),
    specialNotes: stringValue(value.specialNotes ?? value.special_notes ?? value.notes),
    remarks: stringValue(value.remarks)
  };
}

function formatMeals(value: InvoiceItineraryDay["meals"]) {
  if (!value) return "Not included";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(" / ") || "Not included";
  return Object.entries(value)
    .map(([key, meal]) => `${formatLabel(key)}: ${String(meal)}`)
    .join(" / ");
}

function formatAttractions(value: unknown) {
  if (!value) return "Not included";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          return String(row.name ?? row.title ?? row.description ?? "").trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(" / ");
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map(String)
      .filter(Boolean)
      .join(" / ");
  }
  return String(value);
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
