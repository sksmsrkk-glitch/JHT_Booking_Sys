/**
 * @file 한글 책임: `reservation` 업무 기능의 입력 정규화, 상태 변환 또는 화면용 데이터를 구성합니다.
 * 여러 화면과 API가 같은 규칙을 재사용하도록 도메인 결정을 모으고, 공급사 원가와 파트너 공개 데이터의 경계를 유지합니다.
 */
import type {
  ReservationDetail,
  ReservationListItem,
  ReservationOperationTaskItem,
  ReservationQuoteItem,
  ReservationSupplierMessageItem
} from "./types";

const demoTasks: Record<string, ReservationOperationTaskItem[]> = {
  "preview-thailand-oct": [
    makeTask("th-hotel-block", "hotel_booking", "hotel_booking", "Hotel block request", "done"),
    makeTask("th-hotel-final", "hotel_booking", "hotel_reconfirm_final", "Hotel final reconfirm", "todo"),
    makeTask("th-vehicle", "vehicle_booking", "vehicle_booking", "Reserve coach", "done"),
    makeTask("th-guide", "guide_assignment", "guide_assignment", "Assign Thai-speaking guide", "todo"),
    makeTask("th-driver", "vehicle_booking", "driver_information", "Collect driver information", "todo")
  ],
  "preview-worldtravellers-apr": [
    makeTask("wt-hotel-block", "hotel_booking", "hotel_booking", "Hotel room block", "done"),
    makeTask("wt-hotel-final", "hotel_booking", "hotel_reconfirm_final", "Hotel final reconfirm", "done"),
    makeTask("wt-vehicle", "vehicle_booking", "vehicle_booking", "Vehicle booking", "done"),
    makeTask("wt-guide", "guide_assignment", "guide_assignment", "Guide assignment", "done"),
    makeTask("wt-driver", "vehicle_booking", "driver_information", "Driver information", "done")
  ],
  "preview-busan-seoul-sep": [
    makeTask("bs-hotel-block", "hotel_booking", "hotel_booking", "Busan and Seoul hotel block", "todo"),
    makeTask("bs-vehicle", "vehicle_booking", "vehicle_booking", "Coach route booking", "todo"),
    makeTask("bs-guide", "guide_assignment", "guide_assignment", "Guide assignment", "done")
  ],
  "preview-tokio-marine-oct": [
    makeTask("tm-hotel-block", "hotel_booking", "hotel_booking", "Hotel block", "done"),
    makeTask("tm-hotel-final", "hotel_booking", "hotel_reconfirm_final", "Hotel final reconfirm", "done"),
    makeTask("tm-vehicle", "vehicle_booking", "vehicle_booking", "Vehicle booking", "done"),
    makeTask("tm-guide", "guide_assignment", "guide_assignment", "Guide assignment", "done")
  ]
};

const demoQuoteItems: Record<string, ReservationQuoteItem[]> = {
  "preview-thailand-oct": [
    makeQuoteItem("th-hotel", "hotel", "hotel", "Bernoui Seoul or similar class - twin room block", "Proposed Seoul hotel", 8800000, 10120000),
    makeQuoteItem("th-vehicle", "transport", "vehicle", "Staria 11-seater vehicle service", "Private vehicle supplier", 1440000, 1656000),
    makeQuoteItem("th-guide", "guide", "guide", "English and Thai speaking guide", "Guide service", 1080000, 1242000),
    makeQuoteItem("th-ticket", "attraction", "ticket", "Gyeongbok Palace + Hanbok + Nanta Show", "Attraction cost master", 1100000, 1265000)
  ],
  "preview-worldtravellers-apr": [
    makeQuoteItem("wt-hotel", "hotel", "hotel", "Seoul hotel twin room block", "Seoul hotel supplier", 7200000, 8280000),
    makeQuoteItem("wt-vehicle", "transport", "vehicle", "45-seat coach service", "Coach supplier", 2100000, 2415000),
    makeQuoteItem("wt-meal", "meal", "meal", "Korean set meals and farewell dinner", "Restaurant package", 2800000, 3220000),
    makeQuoteItem("wt-guide", "guide", "guide", "English speaking guide", "Guide service", 900000, 1035000)
  ],
  "preview-busan-seoul-sep": [
    makeQuoteItem("bs-hotel", "hotel", "hotel", "Busan and Seoul split-stay hotel rooms", "Hotel supplier", 9600000, 11040000),
    makeQuoteItem("bs-vehicle", "transport", "vehicle", "Busan to Seoul coach route", "Coach supplier", 2800000, 3220000),
    makeQuoteItem("bs-ticket", "attraction", "ticket", "Busan city tour and Seoul attractions", "Attraction cost master", 1500000, 1725000)
  ],
  "preview-tokio-marine-oct": [
    makeQuoteItem("tm-hotel", "hotel", "hotel", "Seoul corporate group hotel block", "Corporate hotel supplier", 11200000, 12880000),
    makeQuoteItem("tm-vehicle", "transport", "vehicle", "Corporate coach and airport transfer", "Coach supplier", 2300000, 2645000),
    makeQuoteItem("tm-guide", "guide", "guide", "Japanese/English guide", "Guide service", 1200000, 1380000)
  ]
};

const demoMessages: Record<string, ReservationSupplierMessageItem[]> = {
  "preview-thailand-oct": [
    makeMessage("th-hotel-booking", "hotel", "booking_request", "sent"),
    makeMessage("th-vehicle-booking", "vehicle", "booking_request", "approved")
  ],
  "preview-worldtravellers-apr": [
    makeMessage("wt-hotel-booking", "hotel", "booking_request", "sent"),
    makeMessage("wt-hotel-final", "hotel", "final_confirmation", "sent"),
    makeMessage("wt-vehicle-booking", "vehicle", "booking_request", "sent"),
    makeMessage("wt-vehicle-final", "vehicle", "final_confirmation", "sent"),
    makeMessage("wt-guide-final", "guide", "final_confirmation", "sent")
  ],
  "preview-busan-seoul-sep": [
    makeMessage("bs-guide-booking", "guide", "booking_request", "sent")
  ],
  "preview-tokio-marine-oct": [
    makeMessage("tm-hotel-booking", "hotel", "booking_request", "sent"),
    makeMessage("tm-hotel-final", "hotel", "final_confirmation", "sent"),
    makeMessage("tm-vehicle-booking", "vehicle", "booking_request", "sent")
  ]
};

export const demoReservations: ReservationListItem[] = [
  makeReservationListItem({
    id: "preview-thailand-oct",
    reservationCode: "RSV-2026-TH-001",
    status: "confirmed",
    tourStartDate: "2026-10-12",
    tourEndDate: "2026-10-17",
    agencyName: "Thailand Partner",
    tourName: "Thailand arrival Seoul 4N - Pete",
    estimatedPax: 55,
    roomingListCount: 1
  }),
  makeReservationListItem({
    id: "preview-worldtravellers-apr",
    reservationCode: "RSV-2026-WT-APR",
    status: "confirmed",
    tourStartDate: "2026-04-10",
    tourEndDate: "2026-04-14",
    agencyName: "WorldTravellers",
    tourName: "WorldTravellers Seoul 4N - Jaime Yap",
    estimatedPax: 34,
    roomingListCount: 2
  }),
  makeReservationListItem({
    id: "preview-busan-seoul-sep",
    reservationCode: "RSV-2026-WT-SEP",
    status: "requested",
    tourStartDate: "2026-09-18",
    tourEndDate: "2026-09-22",
    agencyName: "WorldTravellers",
    tourName: "Busan Seoul 4N - Corina Tan",
    estimatedPax: 42,
    roomingListCount: 0
  }),
  makeReservationListItem({
    id: "preview-tokio-marine-oct",
    reservationCode: "RSV-2026-TM-001",
    status: "confirmed",
    tourStartDate: "2026-10-24",
    tourEndDate: "2026-10-28",
    agencyName: "WorldTravellers",
    tourName: "Seoul 4N - Lydia Tokio Marine",
    estimatedPax: 28,
    roomingListCount: 1
  })
];

export function getDemoReservationDetail(reservationId: string): ReservationDetail | null {
  const normalizedReservationId = reservationId === "preview-azza-travel" ? "preview-worldtravellers-apr" : reservationId;
  const reservation = demoReservations.find((item) => item.id === normalizedReservationId);
  if (!reservation) return null;

  return {
    ...reservation,
    acceptedQuoteVersionId: `quote-version-${reservation.id}`,
    acceptedQuoteVersion: {
      id: `quote-version-${reservation.id}`,
      versionNo: 2,
      status: "accepted",
      currency: "KRW",
      publicTotalAmount: (demoQuoteItems[reservation.id] ?? []).reduce((sum, item) => sum + item.totalSellAmount, 0),
      acceptedAt: "2026-06-21T09:00:00+00:00"
    },
    quoteItems: demoQuoteItems[reservation.id] ?? [],
    supplierMessages: demoMessages[reservation.id] ?? [],
    statusHistory: [
      {
        id: `history-${reservation.id}`,
        fromStatus: "pending",
        toStatus: reservation.status,
        reason: "Preview reservation generated from accepted quotation workflow.",
        changedBy: "demo-admin",
        createdAt: reservation.createdAt
      }
    ],
    operationTasks: demoTasks[reservation.id] ?? [],
    roomingLists:
      reservation.roomingListCount > 0
        ? [
            {
              id: `rooming-${reservation.id}`,
              originalFilename: "preview-rooming-list.csv",
              storagePath: `preview/${reservation.reservationCode}/rooming-list.csv`,
              revisionNo: 1,
              parsedStatus: "parsed",
              createdAt: reservation.createdAt
            }
          ]
        : [],
    passengers: [],
    roomAssignments: [],
    supplierOptions: []
  };
}

function makeReservationListItem(input: {
  id: string;
  reservationCode: string;
  status: string;
  tourStartDate: string;
  tourEndDate: string;
  agencyName: string;
  tourName: string;
  estimatedPax: number;
  roomingListCount: number;
}): ReservationListItem {
  const tasks = demoTasks[input.id] ?? [];
  return {
    ...input,
    confirmedAt: input.status === "confirmed" ? "2026-06-21T09:00:00+00:00" : null,
    cancelledAt: null,
    agencyAccountId: `agency-${input.id}`,
    quoteCaseId: `quote-${input.id}`,
    caseCode: input.reservationCode.replace("RSV", "Q"),
    operationTaskSummary: tasks.map((task) => ({
      id: task.id,
      team: task.team,
      taskType: task.taskType,
      status: task.status
    })),
    taskCount: tasks.length,
    createdAt: "2026-06-21T09:00:00+00:00"
  };
}

function makeTask(
  id: string,
  team: string,
  taskType: string,
  title: string,
  status: string
): ReservationOperationTaskItem {
  return {
    id,
    team,
    taskType,
    title,
    status,
    dueAt: "2026-09-01T09:00:00+00:00",
    completedAt: ["done", "completed"].includes(status) ? "2026-08-20T09:00:00+00:00" : null,
    blockedReason: status === "blocked" ? "Waiting for supplier confirmation." : null,
    domesticSupplierId: null,
    domesticSupplierName: null
  };
}

function makeQuoteItem(
  id: string,
  itemCategory: string,
  serviceSection: string,
  snapshotItemName: string,
  snapshotSupplierName: string,
  totalCostKrw: number,
  totalSellAmount: number
): ReservationQuoteItem {
  return {
    id,
    itemCategory,
    serviceSection,
    snapshotItemName,
    snapshotSupplierName,
    pricingUnit: "per_group",
    quantity: 1,
    paxCount: null,
    totalCostKrw,
    totalSellAmount,
    partnerVisibleNotes: null,
    internalNotes: null
  };
}

function makeMessage(
  id: string,
  domesticSupplierName: string,
  messageType: string,
  status: string
): ReservationSupplierMessageItem {
  return {
    id,
    domesticSupplierId: `supplier-${id}`,
    domesticSupplierName,
    messageType,
    status,
    subject: `${messageType} preview`,
    approvedAt: ["approved", "queued", "sent"].includes(status) ? "2026-08-20T09:00:00+00:00" : null,
    secondApprovedAt: status === "sent" ? "2026-08-20T10:00:00+00:00" : null,
    sentAt: status === "sent" ? "2026-08-20T11:00:00+00:00" : null,
    createdAt: "2026-08-20T09:00:00+00:00"
  };
}
