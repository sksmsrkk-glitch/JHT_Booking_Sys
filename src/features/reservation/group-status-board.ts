/**
 * @file 한글 책임: JHT가 엑셀로 관리하던 "단체 현황표"를 시스템 데이터로 재현하기 위한 조회입니다.
 * 날짜를 가로축으로 두고 단체별 파트너사·인원·객실·가이드·일자별 호텔·항공 IN/OUT을 한 화면에 모읍니다.
 * 전 팀이 공유하는 핵심 정보이므로 내부 원가·마진은 포함하지 않고 운영 정보만 담습니다.
 */

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type GroupBoardNight = {
  /** YYYY-MM-DD */
  date: string;
  hotel: string | null;
  roomType: string | null;
};

export type GroupBoardFlight = {
  kind: "arrival" | "departure" | "other";
  flightNo: string | null;
  date: string | null;
  time: string | null;
  route: string | null;
};

export type GroupBoardRow = {
  reservationId: string;
  reservationCode: string;
  tourName: string | null;
  agencyName: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  paxCount: number | null;
  /** 예: "2D 1T 1S" — 객실 타입별 개수 요약 */
  roomSummary: string | null;
  roomCount: number;
  guideName: string | null;
  guidePhone: string | null;
  tourLeaderName: string | null;
  nights: GroupBoardNight[];
  arrival: GroupBoardFlight | null;
  departure: GroupBoardFlight | null;
  /** 인원이 바뀐 경우 등 운영상 주의가 필요한 변경 이력 */
  changeNote: string | null;
};

export type GroupStatusBoard = {
  /** 화면 가로축이 되는 날짜 목록 (YYYY-MM-DD) */
  dates: string[];
  rows: GroupBoardRow[];
  truncated: boolean;
};

const MAX_ROWS = 60;
const MAX_DAYS = 62;

/**
 * 지정 기간과 겹치는 예약을 모아 단체 현황표 데이터를 만듭니다.
 * 기간을 벗어난 투어도 걸쳐 있으면 포함되며, 표시 날짜축은 요청 기간으로 고정합니다.
 */
export async function getGroupStatusBoard(
  supabase: SupabaseClientLike,
  range: { start: string; end: string }
): Promise<GroupStatusBoard> {
  const dates = buildDateAxis(range.start, range.end);
  const rangeStart = dates[0] ?? range.start;
  const rangeEnd = dates[dates.length - 1] ?? range.end;

  const { data, error, count } = await supabase
    .from("reservations")
    .select(
      "id, reservation_code, status, tour_start_date, tour_end_date, quote_cases(tour_name, estimated_pax), agency_accounts(name), reservation_final_operation_snapshots(day_snapshots, flight_details), room_assignments(room_type), guide_expense_reports(guide_name, guide_phone, tour_leader_name, pax_count), reservation_status_history(to_status, reason, created_at)",
      { count: "exact" }
    )
    // 투어 기간이 조회 구간과 겹치는 단체만 가져옵니다(시작 <= 구간끝, 종료 >= 구간시작).
    .lte("tour_start_date", rangeEnd)
    .gte("tour_end_date", rangeStart)
    .not("status", "in", "(cancelled)")
    .order("tour_start_date", { ascending: true })
    .limit(MAX_ROWS);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((row: any) => mapRow(row));
  return { dates, rows, truncated: Number(count ?? rows.length) > rows.length };
}

function mapRow(row: any): GroupBoardRow {
  const quoteCase = resolveOne(row.quote_cases);
  const agency = resolveOne(row.agency_accounts);
  const snapshot = resolveOne(row.reservation_final_operation_snapshots);
  const guide = resolveOne(row.guide_expense_reports);

  const daySnapshots = Array.isArray(snapshot?.day_snapshots) ? snapshot.day_snapshots : [];
  const flights = Array.isArray(snapshot?.flight_details) ? snapshot.flight_details : [];
  const roomTypes = (Array.isArray(row.room_assignments) ? row.room_assignments : [])
    .map((item: any) => String(item?.room_type ?? "").trim())
    .filter(Boolean);

  const nights: GroupBoardNight[] = daySnapshots
    .map((day: any) => ({
      date: normalizeDate(day?.date),
      hotel: cleanText(day?.hotel),
      roomType: cleanText(day?.roomType)
    }))
    .filter((night: GroupBoardNight) => Boolean(night.date));

  return {
    reservationId: row.id,
    reservationCode: row.reservation_code,
    tourName: cleanText(quoteCase?.tour_name),
    agencyName: cleanText(agency?.name),
    status: row.status,
    startDate: normalizeDate(row.tour_start_date),
    endDate: normalizeDate(row.tour_end_date),
    paxCount: resolvePax(guide?.pax_count, quoteCase?.estimated_pax),
    roomSummary: summarizeRooms(roomTypes),
    roomCount: roomTypes.length,
    guideName: cleanText(guide?.guide_name),
    guidePhone: cleanText(guide?.guide_phone),
    tourLeaderName: cleanText(guide?.tour_leader_name),
    nights,
    arrival: pickFlight(flights, "arrival"),
    departure: pickFlight(flights, "departure"),
    changeNote: resolveChangeNote(row.reservation_status_history)
  };
}

/** 객실 타입 목록을 "2D 1T 1S"처럼 엑셀에서 쓰던 축약 표기로 만듭니다. */
function summarizeRooms(roomTypes: string[]): string | null {
  if (roomTypes.length === 0) return null;
  const counts = new Map<string, number>();
  for (const type of roomTypes) {
    const key = abbreviateRoomType(type);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => `${count}${key}`).join(" ");
}

function abbreviateRoomType(value: string) {
  const text = value.toLowerCase();
  if (text.includes("triple")) return "TRP";
  if (text.includes("twin")) return "T";
  if (text.includes("double")) return "D";
  if (text.includes("single")) return "S";
  if (text.includes("suite")) return "SUI";
  if (text.includes("family")) return "FAM";
  return value.slice(0, 3).toUpperCase();
}

function pickFlight(flights: any[], kind: "arrival" | "departure"): GroupBoardFlight | null {
  const match = flights.find((flight: any) => String(flight?.type ?? "").toLowerCase() === kind);
  if (!match) return null;
  return {
    kind,
    flightNo: cleanText(match.flightNo),
    date: normalizeDate(match.date),
    time: cleanText(match.time),
    route: cleanText(match.route)
  };
}

/*
 * 엑셀에서는 "41->39a"처럼 인원 변경을 직접 적어 공유했습니다.
 * 시스템에서는 예약 상태 이력의 최근 변경 사유를 같은 자리에 노출합니다.
 */
function resolveChangeNote(history: any): string | null {
  const rows = Array.isArray(history) ? history : [];
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (left, right) => new Date(right?.created_at ?? 0).getTime() - new Date(left?.created_at ?? 0).getTime()
  );
  const latest = sorted[0];
  const status = cleanText(latest?.to_status);
  const reason = cleanText(latest?.reason);
  if (!status && !reason) return null;
  if (status && reason) return `${status} · ${reason}`;
  return status ?? reason;
}

function resolvePax(guidePax: unknown, estimatedPax: unknown): number | null {
  const guideValue = toNumber(guidePax);
  if (guideValue !== null) return guideValue;
  return toNumber(estimatedPax);
}

/** 조회 구간을 하루 단위 날짜 배열로 펼칩니다. 과도한 폭을 막기 위해 상한을 둡니다. */
export function buildDateAxis(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const dates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime() && dates.length < MAX_DAYS) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function normalizeDate(value: unknown): string | null {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return null;
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveOne(value: unknown) {
  // PostgREST 1:1 임베드는 객체 또는 단일 요소 배열로 옵니다.
  if (Array.isArray(value)) return value[0] ?? null;
  return (value as Record<string, unknown> | null) ?? null;
}
