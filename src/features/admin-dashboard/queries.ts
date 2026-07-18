/**
 * @file 한글 책임: `admin-dashboard` 기능이 사용하는 Supabase 조회와 영속 데이터 매핑을 한곳에 모읍니다.
 * RLS가 보장하는 접근 범위를 유지하면서 목록 상한·필터·정렬을 DB에 위임하고 화면에는 안정된 도메인 모델만 반환합니다.
 */
type SupabaseClientLike = {
  rpc: (name: string, args?: Record<string, unknown>) => any;
};

export type AdminDashboardFilters = {
  country?: string;
  agencyAccountId?: string;
  from?: string;
  to?: string;
};

export type AdminDashboardMetric = {
  quoteInquiryCount: number;
  confirmedCount: number;
  cancelledCount: number;
  totalInquiryCount: number;
  quoteCaseCount: number;
  activeReservationCount: number;
  paxCount: number;
  settlementDoneCount: number;
  receivableCount: number;
  receivableAmount: number;
};

export type AdminDashboardRow = {
  key: string;
  label: string;
  quoteInquiries: number;
  confirmed: number;
  cancelled: number;
  inquiries: number;
  quoteCases: number;
  pax: number;
  settlementDone: number;
  receivableCount: number;
  receivableAmount: number;
};

export type AdminDashboardAgencyOption = {
  id: string;
  name: string;
  countryCode: string;
};

export type AdminDashboardAnalytics = {
  metrics: AdminDashboardMetric;
  countryRows: AdminDashboardRow[];
  partnerRows: AdminDashboardRow[];
  periodRows: AdminDashboardRow[];
  statusRows: AdminDashboardRow[];
  agencyOptions: AdminDashboardAgencyOption[];
};

export async function getAdminDashboardAnalytics(
  supabase: SupabaseClientLike,
  filters: AdminDashboardFilters
): Promise<AdminDashboardAnalytics> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_analytics", {
    p_country: filters.country ?? null,
    p_agency_account_id: filters.agencyAccountId ?? null,
    p_from: filters.from ?? null,
    p_to: filters.to ?? null
  });
  if (error) throw new Error(error.message);

  const payload = asRecord(data);
  const metrics = asRecord(payload.metrics);
  return {
    metrics: {
      quoteInquiryCount: toNumber(metrics.quoteInquiryCount),
      confirmedCount: toNumber(metrics.confirmedCount),
      cancelledCount: toNumber(metrics.cancelledCount),
      totalInquiryCount: toNumber(metrics.totalInquiryCount),
      quoteCaseCount: toNumber(metrics.quoteCaseCount),
      activeReservationCount: toNumber(metrics.activeReservationCount),
      paxCount: toNumber(metrics.paxCount),
      settlementDoneCount: toNumber(metrics.settlementDoneCount),
      receivableCount: toNumber(metrics.receivableCount),
      receivableAmount: toNumber(metrics.receivableAmount)
    },
    countryRows: mapRows(payload.countryRows),
    partnerRows: mapRows(payload.partnerRows),
    periodRows: mapRows(payload.periodRows),
    statusRows: mapRows(payload.statusRows),
    agencyOptions: asArray(payload.agencyOptions).map((item) => {
      const row = asRecord(item);
      return {
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        countryCode: String(row.countryCode ?? "UNKNOWN")
      };
    }).filter((agency) => agency.id && agency.name)
  };
}

export function emptyAdminDashboardAnalytics(): AdminDashboardAnalytics {
  return {
    metrics: {
      quoteInquiryCount: 0,
      confirmedCount: 0,
      cancelledCount: 0,
      totalInquiryCount: 0,
      quoteCaseCount: 0,
      activeReservationCount: 0,
      paxCount: 0,
      settlementDoneCount: 0,
      receivableCount: 0,
      receivableAmount: 0
    },
    countryRows: [],
    partnerRows: [],
    periodRows: [],
    statusRows: [],
    agencyOptions: []
  };
}

function mapRows(value: unknown): AdminDashboardRow[] {
  return asArray(value).map((item) => {
    const row = asRecord(item);
    return {
      key: String(row.key ?? ""),
      label: String(row.label ?? ""),
      quoteInquiries: toNumber(row.quoteInquiries ?? row.quote_inquiries),
      confirmed: toNumber(row.confirmed),
      cancelled: toNumber(row.cancelled),
      inquiries: toNumber(row.inquiries),
      quoteCases: toNumber(row.quoteCases ?? row.quote_cases),
      pax: toNumber(row.pax),
      settlementDone: toNumber(row.settlementDone ?? row.settlement_done),
      receivableCount: toNumber(row.receivableCount ?? row.receivable_count),
      receivableAmount: toNumber(row.receivableAmount ?? row.receivable_amount)
    };
  }).filter((row) => row.key && row.label);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}
