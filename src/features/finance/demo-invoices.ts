/**
 * @file 한글 책임: `finance` 업무 기능의 입력 정규화, 상태 변환 또는 화면용 데이터를 구성합니다.
 * 여러 화면과 API가 같은 규칙을 재사용하도록 도메인 결정을 모으고, 공급사 원가와 파트너 공개 데이터의 경계를 유지합니다.
 */
import type { AgencyInvoiceDetail, AgencyInvoiceListItem } from "@/features/agency-portal/types";
import type { InvoiceDetail, InvoiceListItem } from "@/features/finance/types";

export const demoAgencyInvoice: AgencyInvoiceDetail = {
  id: "preview-invoice-mhdm-v1",
  invoiceNo: "SHTTV0611G-v1",
  reservationId: "preview-reservation-mhdm",
  reservationCode: "RSV-MY-WORLDTRAV-20260629",
  agencyName: "WorldTravellers",
  tourName: "MHDM Seoul 4N Group",
  tourCode: "MY-WORLDTRAVE-20260629",
  versionNo: 1,
  status: "partially_paid",
  currency: "MYR",
  totalAmount: 183740,
  issuedAt: "2026-06-29T10:00:00+09:00",
  dueDate: "2026-07-15",
  paymentDeadline: "2026-07-15",
  collectionTiming: "deposit_then_final",
  collectionStatus: "partially_paid",
  depositRequired: true,
  depositAmount: 50000,
  storagePath: "preview/invoices/SHTTV0611G-v1.xlsx",
  confirmedPaymentTotal: 50000,
  paymentCount: 1,
  createdAt: "2026-06-29T10:00:00+09:00",
  bankAccountSnapshot: {
    payableTo: "JUNGHOTRAVEL CO., LTD.",
    bankName: "Woori Bank",
    accountNo: "Preview account",
    swiftCode: "HVBKKRSE",
    remark: "Please quote invoice number and tour code when remitting."
  },
  flightDetails: [
    { type: "Arrival", flightNo: "MH066", date: "2026-03-24", time: "07:10", route: "KUL-ICN" },
    { type: "Departure", flightNo: "MH067", date: "2026-03-28", time: "11:00", route: "ICN-KUL" }
  ],
  itinerarySnapshot: [
    {
      day: 1,
      date: "2026-03-24",
      title: "Arrival Seoul / Hotel check-in",
      hotel: "Seoul 4-star business hotel or similar",
      meals: { lunch: "Local Korean set menu", dinner: "Hotel nearby restaurant" },
      attractions: ["Incheon Airport meet and greet", "Seoul city orientation", "Myeongdong walking street"],
      description: "Arrival assistance, private coach transfer to Seoul, guide briefing, and hotel check-in.",
      specialNotes: "Flight arrival time must be reconfirmed before final vehicle dispatch."
    },
    {
      day: 2,
      date: "2026-03-25",
      title: "Seoul city tour and group meal",
      hotel: "Seoul 4-star business hotel or similar",
      meals: { breakfast: "Hotel breakfast", lunch: "Bibimbap set", dinner: "Korean BBQ group dinner" },
      attractions: ["Gyeongbokgung Palace", "Bukchon Hanok Village", "Insadong", "N Seoul Tower photo stop"],
      description: "Full-day Seoul cultural sightseeing with English-speaking guide and private coach.",
      specialNotes: "Halal-friendly and vegetarian meal alternatives to be reconfirmed with restaurant."
    },
    {
      day: 3,
      date: "2026-03-26",
      title: "Business visit and incentive dinner",
      hotel: "Seoul 4-star business hotel or similar",
      meals: { breakfast: "Hotel breakfast", lunch: "Conference lunch", dinner: "Private banquet dinner" },
      attractions: ["Corporate visit", "Team building program", "Private banquet room"],
      description: "Business program, incentive activity, banquet room setup, PA system, and group dinner.",
      specialNotes: "Banquet room AV setup includes beam projector, microphone, and basic PA system."
    },
    {
      day: 4,
      date: "2026-03-27",
      title: "Free program / Shopping",
      hotel: "Seoul 4-star business hotel or similar",
      meals: { breakfast: "Hotel breakfast", lunch: "Own arrangement", dinner: "Seafood hotpot" },
      attractions: ["Cosmetic shop", "Ginseng center", "Hongdae free time"],
      description: "Flexible shopping and leisure day with coach standby by confirmed schedule.",
      specialNotes: "Shopping stops can be adjusted if partner requests non-shopping itinerary."
    },
    {
      day: 5,
      date: "2026-03-28",
      title: "Departure",
      hotel: "Check-out",
      meals: { breakfast: "Hotel breakfast" },
      attractions: ["Hotel check-out", "Airport transfer", "Departure assistance"],
      description: "Guide assists with luggage check, airport transfer, and departure procedure.",
      specialNotes: "Final rooming and luggage truck requirement must be confirmed one day before departure."
    }
  ],
  lineItems: [
    {
      id: "preview-line-1",
      lineNo: 1,
      description: "Group tour package - adult",
      serviceDate: "2026-03-24",
      category: "package",
      currency: "MYR",
      unitAmount: 6120,
      quantity: 26,
      unitLabel: "per pax",
      totalAmount: 159120,
      notes: "Hotel, vehicle, guide, meals, and attractions"
    },
    {
      id: "preview-line-2",
      lineNo: 2,
      description: "Single room supplement",
      serviceDate: "2026-03-24",
      category: "hotel",
      currency: "MYR",
      unitAmount: 1080,
      quantity: 6,
      unitLabel: "room/night set",
      totalAmount: 6480,
      notes: "Applied only to requested single rooms"
    },
    {
      id: "preview-line-3",
      lineNo: 3,
      description: "Tour guide and driver tipping",
      serviceDate: null,
      category: "service",
      currency: "MYR",
      unitAmount: 30,
      quantity: 156,
      unitLabel: "pax/day",
      totalAmount: 4680,
      notes: "Per invoice terms"
    },
    {
      id: "preview-line-4",
      lineNo: 4,
      description: "Private coach extension and airport support",
      serviceDate: null,
      category: "vehicle",
      currency: "MYR",
      unitAmount: 13460,
      quantity: 1,
      unitLabel: "group",
      totalAmount: 13460,
      notes: "Includes arrival/departure support"
    }
  ],
  payments: [
    {
      id: "preview-payment-1",
      status: "confirmed",
      currency: "MYR",
      amount: 50000,
      receivedAt: "2026-06-29T12:00:00+09:00",
      method: "Bank transfer",
      createdAt: "2026-06-29T12:00:00+09:00"
    }
  ]
};

export const demoAgencyInvoices: AgencyInvoiceListItem[] = [demoAgencyInvoice];

export const demoFinanceInvoice: InvoiceDetail = {
  ...demoAgencyInvoice,
  lineItems: demoAgencyInvoice.lineItems.map((item) => ({
    ...item,
    metadata: {}
  })),
  payments: [
    {
      ...demoAgencyInvoice.payments[0],
      referenceNo: "PREVIEW-DEPOSIT-001",
      idempotencyKey: "preview-payment-20260629"
    }
  ],
  invoicePayload: {
    sourceWorkbook: "2025.03- invoice for 24 mar x 26 paxs - World Travellsers (mhdm).xlsx",
    versionReason: "Initial invoice generated from confirmed quote",
    groupSplitSheets: ["GRP1", "GRP2", "GRP3", "CREW1,2", "CREW3"]
  },
  expenseCount: 0,
  settlementStatus: "review",
  finalProfitAmount: null
};

export const demoFinanceInvoices: InvoiceListItem[] = [demoFinanceInvoice];
