/**
 * @file 한글 책임: 어드민 대시보드 상단의 "오늘 할 일" 큐를 조회합니다.
 * 예전 대시보드는 집계 숫자만 보여줘 담당자가 "지금 뭘 해야 하는지" 알려면 5개 페이지를 순회해야 했습니다.
 * 여기서는 급한 순서(지연 → 대기 → 알림)로 실제 처리 대상을 모읍니다. RLS 범위 안에서만 조회합니다.
 */

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type WorkQueueItem = {
  id: string;
  /** danger: 기한 초과 · warning: 대기 중 · info: 참고 */
  tone: "danger" | "warning" | "info";
  categoryKo: string;
  categoryEn: string;
  labelKo: string;
  labelEn: string;
  href: string;
  count: number;
};

const MAX_PER_GROUP = 200;

export async function listAdminWorkQueue(supabase: SupabaseClientLike): Promise<WorkQueueItem[]> {
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);

  const [overdueTasks, overdueInvoices, draftMessages, openRequests, failedMessages, queuedNotifications] =
    await Promise.all([
      countRows(supabase, "operation_tasks", (query: any) =>
        query.not("due_at", "is", null).lt("due_at", nowIso).not("status", "in", "(done,cancelled)")
      ),
      countRows(supabase, "invoices", (query: any) =>
        query.not("due_date", "is", null).lt("due_date", today).in("status", ["issued", "partially_paid", "overdue"])
      ),
      countRows(supabase, "supplier_message_outbox", (query: any) => query.eq("status", "draft")),
      countRows(supabase, "agency_inquiries", (query: any) => query.in("status", ["new", "in_review"])),
      countRows(supabase, "supplier_message_outbox", (query: any) => query.eq("status", "failed")),
      countRows(supabase, "notifications", (query: any) => query.in("status", ["queued", "sent"]))
    ]);

  const items: WorkQueueItem[] = [
    {
      id: "overdue-tasks",
      tone: "danger",
      categoryKo: "지연",
      categoryEn: "Overdue",
      labelKo: "기한이 지난 운영 업무",
      labelEn: "Operation tasks past due",
      href: "/admin/operations/tasks",
      count: overdueTasks
    },
    {
      id: "overdue-invoices",
      tone: "danger",
      categoryKo: "연체",
      categoryEn: "Overdue",
      labelKo: "결제 기한이 지난 인보이스",
      labelEn: "Invoices past the due date",
      href: "/admin/finance/invoices",
      count: overdueInvoices
    },
    {
      id: "draft-messages",
      tone: "warning",
      categoryKo: "승인 대기",
      categoryEn: "Approval",
      labelKo: "승인 대기 중인 공급사 메시지",
      labelEn: "Supplier messages waiting for approval",
      href: "/admin/supplier-messages",
      count: draftMessages
    },
    {
      id: "open-requests",
      tone: "warning",
      categoryKo: "파트너 요청",
      categoryEn: "Partner",
      labelKo: "아직 처리하지 않은 파트너 요청",
      labelEn: "Partner requests not handled yet",
      href: "/admin/quote-cases",
      count: openRequests
    },
    {
      id: "failed-jobs",
      tone: "warning",
      categoryKo: "실패",
      categoryEn: "Failed",
      labelKo: "실패한 공급사 발송 작업",
      labelEn: "Failed supplier delivery jobs",
      href: "/admin/automation/failed-jobs",
      count: failedMessages
    },
    {
      id: "notifications",
      tone: "info",
      categoryKo: "알림",
      categoryEn: "Reminders",
      labelKo: "확인하지 않은 리마인더",
      labelEn: "Unacknowledged reminders",
      href: "/admin/operations/tasks",
      count: queuedNotifications
    }
  ];

  // 처리할 것이 있는 항목만, 급한 순서로 보여줍니다.
  const tonePriority = { danger: 0, warning: 1, info: 2 } as const;
  return items
    .filter((item) => item.count > 0)
    .sort((left, right) => tonePriority[left.tone] - tonePriority[right.tone] || right.count - left.count);
}

/*
 * count: "exact" + head 조회는 행 본문을 가져오지 않아 목록 상한과 무관하게 정확한 건수를 얻습니다.
 * 권한 부족 등으로 실패하면 대시보드 전체가 막히지 않도록 0으로 처리합니다.
 */
async function countRows(
  supabase: SupabaseClientLike,
  table: string,
  applyFilters: (query: any) => any
): Promise<number> {
  try {
    const base = supabase.from(table).select("id", { count: "exact", head: true }).limit(MAX_PER_GROUP);
    const { count, error } = await applyFilters(base);
    if (error) return 0;
    return Number(count ?? 0);
  } catch {
    return 0;
  }
}
