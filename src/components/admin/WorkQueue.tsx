/**
 * @file 한글 책임: 어드민 대시보드 최상단의 "오늘 할 일" 큐 표시를 담당합니다.
 * 숫자 성적표보다 먼저 실제 처리 대상을 급한 순서로 보여줘, 담당자가 페이지를 순회하지 않게 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import type { WorkQueueItem } from "@/features/admin-dashboard/work-queue";
import type { Locale } from "@/lib/i18n";

export function WorkQueue({ items, locale }: { items: WorkQueueItem[]; locale: Locale }) {
  const isKo = locale === "ko";

  return (
    <section className="work-queue" aria-label={isKo ? "오늘 할 일" : "Today's work queue"}>
      <div className="section-heading">
        <div>
          <h2>{isKo ? "오늘 할 일" : "Today"}</h2>
          <p>
            {isKo
              ? "급한 순서로 처리 대상만 모았습니다."
              : "Only what needs action, most urgent first."}
          </p>
        </div>
        <span>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="subtext work-queue-clear">
          {isKo ? "지금 처리할 항목이 없습니다." : "Nothing needs action right now."}
        </p>
      ) : (
        <ul className="work-queue-list">
          {items.map((item) => (
            <li className={`work-queue-item tone-${item.tone}`} key={item.id}>
              <span className="work-queue-count">{item.count}</span>
              <span className="work-queue-body">
                <small>{isKo ? item.categoryKo : item.categoryEn}</small>
                <span>{isKo ? item.labelKo : item.labelEn}</span>
              </span>
              <Link className="button-secondary compact-button" href={item.href as Route}>
                {isKo ? "열기" : "Open"}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
