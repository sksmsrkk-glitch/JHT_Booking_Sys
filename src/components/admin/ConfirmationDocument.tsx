/**
 * @file 한글 책임: `Confirmation Document` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
import type { ReservationDetail } from "@/features/reservation/types";

export function ConfirmationDocument({ reservation }: { reservation: ReservationDetail }) {
  const hotelItems = reservation.quoteItems.filter((item) =>
    /hotel|room|meeting_room/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`)
  );
  const mealItems = reservation.quoteItems.filter((item) =>
    /meal|restaurant|breakfast|lunch|dinner/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`)
  );
  const attractionItems = reservation.quoteItems.filter((item) =>
    /ticket|attraction|program|show|experience/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`)
  );
  const transportItems = reservation.quoteItems.filter((item) =>
    /vehicle|transport|coach|bus|van|car/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`)
  );
  const guideItems = reservation.quoteItems.filter((item) =>
    /guide/i.test(`${item.itemCategory} ${item.serviceSection ?? ""} ${item.snapshotItemName}`)
  );

  return (
    <section className="confirmation-document" aria-label={`${reservation.reservationCode} confirmation document`}>
      <div className="confirmation-document-header">
        <div>
          <p className="eyebrow">Jungho Travel Final Confirmation</p>
          <h2>{reservation.tourName ?? reservation.reservationCode}</h2>
          <p>{reservation.reservationCode}</p>
        </div>
        <span className={`status-dot status-${reservation.status}`}>{formatLabel(reservation.status)}</span>
      </div>

      <dl className="definition-list columns">
        <div>
          <dt>Agency</dt>
          <dd>{reservation.agencyName ?? reservation.agencyAccountId}</dd>
        </div>
        <div>
          <dt>Tour Dates</dt>
          <dd>{formatDateRange(reservation.tourStartDate, reservation.tourEndDate)}</dd>
        </div>
        <div>
          <dt>Accepted Quote</dt>
          <dd>
            {reservation.acceptedQuoteVersion
              ? `Version ${reservation.acceptedQuoteVersion.versionNo} / ${reservation.acceptedQuoteVersion.currency} ${reservation.acceptedQuoteVersion.publicTotalAmount.toLocaleString()}`
              : "Not linked"}
          </dd>
        </div>
        <div>
          <dt>Pax</dt>
          <dd>{reservation.estimatedPax ?? "Not set"}</dd>
        </div>
      </dl>

      <section className="confirmation-section-grid">
        <ConfirmationSection title="Hotel / Room" items={hotelItems} emptyText="Final hotel will be added by operation team." />
        <ConfirmationSection title="Meals / Menus" items={mealItems} emptyText="Meal details will be added by operation team." />
        <ConfirmationSection title="Attractions / Program" items={attractionItems} emptyText="Program details will be added by operation team." />
        <ConfirmationSection title="Vehicle / Transport" items={transportItems} emptyText="Vehicle details will be added by booking team." />
        <ConfirmationSection title="Guide" items={guideItems} emptyText="Guide assignment will be added by operation team." />
      </section>

      <section className="confirmation-note">
        <h3>Operation Confirmation Requirements</h3>
        <ul className="clean-list">
          <li>Hotel name, room type, check-in/out and reconfirmation number must be finalized before invoice issue.</li>
          <li>Menus, dietary requirements, attractions, show tickets, and team-building items must match supplier final confirmations.</li>
          <li>Flight, driver, vehicle, guide, and emergency contact details should be updated before partner delivery.</li>
        </ul>
      </section>
    </section>
  );
}

function ConfirmationSection({
  title,
  items,
  emptyText
}: {
  title: string;
  items: ReservationDetail["quoteItems"];
  emptyText: string;
}) {
  return (
    <article className="confirmation-section">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul className="clean-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.snapshotItemName}</strong>
              <span className="subtext">
                {item.partnerVisibleNotes ?? item.pricingUnit}
                {item.paxCount ? ` / ${item.paxCount} pax` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyText}</p>
      )}
    </article>
  );
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
