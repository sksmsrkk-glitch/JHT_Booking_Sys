/**
 * @file 한글 책임: 단체 상황판(투어 코드 1건의 전체 진행 상황)의 표시를 담당합니다.
 * 진행 단계, 지금 해야 할 일, 금액 요약을 한 화면에 모아 담당자가 페이지를 순회하지 않게 합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import type { GroupCockpit as GroupCockpitData } from "@/features/workflow/cockpit";
import type { Locale } from "@/lib/i18n";

export function GroupCockpit({ cockpit, locale }: { cockpit: GroupCockpitData; locale: Locale }) {
  const isKo = locale === "ko";

  return (
    <section className="cockpit" aria-label={isKo ? "단체 진행 상황판" : "Group progress cockpit"}>
      <div className="cockpit-head">
        <div>
          <h2>{cockpit.title}</h2>
          <p className="subtext">
            {[
              cockpit.agencyName,
              cockpit.paxCount ? `${cockpit.paxCount}${isKo ? "명" : " pax"}` : null,
              formatDateRange(cockpit.tourStartDate, cockpit.tourEndDate)
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span className="cockpit-code">{cockpit.workflowCode}</span>
      </div>

      <ol className="cockpit-stages" aria-label={isKo ? "진행 단계" : "Lifecycle stages"}>
        {cockpit.stages.map((stage) => (
          <li className={`cockpit-stage is-${stage.state}`} key={stage.key}>
            <span className="cockpit-stage-bar" aria-hidden="true" />
            <span className="cockpit-stage-label">{isKo ? stage.labelKo : stage.labelEn}</span>
            {stage.detail ? <small>{stage.detail}</small> : null}
          </li>
        ))}
      </ol>

      {cockpit.actions.length > 0 ? (
        <div className="cockpit-actions">
          {cockpit.actions.map((action) => (
            <div className={`cockpit-action tone-${action.tone}`} key={`${action.tone}-${action.href}-${action.labelEn}`}>
              <div>
                <p className="cockpit-action-eyebrow">{isKo ? "지금 할 일" : "Next action"}</p>
                <p className="cockpit-action-label">{isKo ? action.labelKo : action.labelEn}</p>
              </div>
              <Link className="button-primary compact-button" href={action.href as Route}>
                {isKo ? "바로가기" : "Open"}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="subtext cockpit-clear">
          {isKo ? "지금 처리할 항목이 없습니다." : "Nothing needs action right now."}
        </p>
      )}

      <dl className="cockpit-money">
        <div>
          <dt>{isKo ? "공개가" : "Public total"}</dt>
          <dd>{formatMoney(cockpit.money.currency, cockpit.money.publicTotal)}</dd>
        </div>
        <div>
          <dt>{isKo ? "내부 원가" : "Internal cost"}</dt>
          <dd>{formatMoney("KRW", cockpit.money.internalCost)}</dd>
        </div>
        <div>
          <dt>{isKo ? "마진" : "Margin"}</dt>
          <dd className="cockpit-margin">{formatMoney("KRW", cockpit.money.internalMargin)}</dd>
        </div>
        <div>
          <dt>{isKo ? "인보이스 / 입금" : "Invoiced / paid"}</dt>
          <dd>
            {formatMoney(cockpit.money.currency, cockpit.money.invoiceTotal)}
            <span className="subtext"> / {formatMoney(cockpit.money.currency, cockpit.money.confirmedPaid)}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function formatMoney(currency: string | null, value: number | null) {
  if (value === null || value === undefined) return "-";
  const amount = value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return currency ? `${currency} ${amount}` : amount;
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  if (start && end) return `${start} - ${end}`;
  return start ?? end;
}
