/**
 * @file 한글 책임: 단체 현황표(달력형) 표시를 담당합니다.
 * JHT가 엑셀로 공유하던 형식 그대로, 왼쪽에 단체 정보를 고정하고 오른쪽 날짜축에 일자별 호텔을 배치합니다.
 */
import type { Route } from "next";
import Link from "next/link";
import type { GroupBoardRow, GroupStatusBoard as GroupStatusBoardData } from "@/features/reservation/group-status-board";
import type { Locale } from "@/lib/i18n";

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function GroupStatusBoard({ board, locale }: { board: GroupStatusBoardData; locale: Locale }) {
  const isKo = locale === "ko";

  return (
    <section className="group-board" aria-label={isKo ? "단체 현황표" : "Group status board"}>
      <div className="section-heading">
        <div>
          <h2>{isKo ? "단체 현황표" : "Group Status Board"}</h2>
          <p>
            {isKo
              ? "날짜별 배정 호텔과 파트너사·인원·객실·가이드·항공을 한 화면에서 공유합니다."
              : "Per-night hotels with partner, pax, rooms, guide, and flights in one shared view."}
          </p>
        </div>
        <span>{board.rows.length}</span>
      </div>

      {board.rows.length === 0 ? (
        <p className="subtext group-board-empty">
          {isKo
            ? "선택한 기간에 진행 중인 단체가 없습니다."
            : "No groups are running in the selected period."}
        </p>
      ) : (
        <div className="group-board-scroll">
          <table className="group-board-table">
            <thead>
              <tr>
                <th className="group-board-sticky" scope="col">
                  {isKo ? "단체" : "Group"}
                </th>
                {board.dates.map((date) => {
                  const day = new Date(`${date}T00:00:00Z`);
                  const weekday = (isKo ? WEEKDAYS_KO : WEEKDAYS_EN)[day.getUTCDay()];
                  const isWeekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
                  return (
                    <th className={isWeekend ? "group-board-day weekend" : "group-board-day"} key={date} scope="col">
                      <span>{date.slice(8, 10)}</span>
                      <small>{weekday}</small>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <tr key={row.reservationId}>
                  <th className="group-board-sticky" scope="row">
                    <GroupSummary isKo={isKo} row={row} />
                  </th>
                  {board.dates.map((date) => {
                    const night = row.nights.find((entry) => entry.date === date);
                    const inRange = isWithinTour(date, row.startDate, row.endDate);
                    const cellClass = [
                      "group-board-cell",
                      inRange ? "in-tour" : "",
                      date === row.startDate ? "tour-start" : "",
                      date === row.endDate ? "tour-end" : ""
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <td className={cellClass} key={date} title={night?.hotel ?? undefined}>
                        {night?.hotel ? <span className="group-board-hotel">{night.hotel}</span> : null}
                        {!night?.hotel && date === row.startDate && row.arrival?.flightNo ? (
                          <span className="group-board-flight">{row.arrival.flightNo}</span>
                        ) : null}
                        {!night?.hotel && date === row.endDate && row.departure?.flightNo ? (
                          <span className="group-board-flight">{row.departure.flightNo}</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {board.truncated ? (
        <p className="subtext group-board-note">
          {isKo
            ? "표시 한도를 초과한 단체가 있습니다. 기간을 좁혀 조회하세요."
            : "Some groups exceed the display limit. Narrow the period to see them."}
        </p>
      ) : null}
    </section>
  );
}

function GroupSummary({ isKo, row }: { isKo: boolean; row: GroupBoardRow }) {
  const pax = row.paxCount === null ? null : `${row.paxCount}${isKo ? "명" : "p"}`;
  const guide = [row.guideName, row.tourLeaderName ? `TL ${row.tourLeaderName}` : null].filter(Boolean).join(" · ");

  return (
    <div className="group-board-summary">
      <Link className="group-board-code" href={`/admin/reservations/${row.reservationId}` as Route}>
        {row.reservationCode}
      </Link>
      <strong>{row.agencyName ?? row.tourName ?? "-"}</strong>
      <span className="group-board-meta">
        {[pax, row.roomSummary, guide || null].filter(Boolean).join(" · ") || (isKo ? "정보 없음" : "No details")}
      </span>
      <span className="group-board-flights">
        {row.arrival?.flightNo ? `IN ${row.arrival.flightNo}${row.arrival.time ? ` ${row.arrival.time}` : ""}` : null}
        {row.arrival?.flightNo && row.departure?.flightNo ? " / " : null}
        {row.departure?.flightNo
          ? `OUT ${row.departure.flightNo}${row.departure.time ? ` ${row.departure.time}` : ""}`
          : null}
      </span>
      {row.changeNote ? <span className="group-board-change">{row.changeNote}</span> : null}
    </div>
  );
}

function isWithinTour(date: string, start: string | null, end: string | null) {
  if (!start || !end) return false;
  return date >= start && date <= end;
}
