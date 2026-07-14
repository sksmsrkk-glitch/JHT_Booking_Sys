import type { Route } from "next";
import Link from "next/link";
import { QuoteRequestActions } from "@/components/agency/QuoteRequestActions";
import type { AgencyQuoteDetail, AgencyQuotePresentationBlock } from "@/features/agency-portal/types";
import { getPageAuthorization } from "@/lib/api/page-session";
import { convertKrwToQuoteCurrency } from "@/lib/domain/currency.mjs";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ shareId: string }>;

type LoadState =
  | { status: "ready"; quoteCase: AgencyQuoteDetail }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const quotesRoute = "/agency/quote-cases" as Route;

export default async function AgencyQuoteDetailPage({ params }: { params: PageParams }) {
  const { shareId } = await params;
  const loadState = await loadQuoteCase(shareId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Overseas Agency Portal</p>
            <h1>Quote Detail</h1>
            <p>Customer-safe itinerary, public totals, and request actions.</p>
          </div>
          <Link className="button-secondary" href={quotesRoute}>
            Back to Quotes
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Quote not found" : "Quote could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const quoteCase = loadState.quoteCase;
  const latestVersion = quoteCase.versions[0] ?? null;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Overseas Agency Portal</p>
          <h1>{quoteCase.tourName}</h1>
          <p>{quoteCase.caseCode}</p>
        </div>
        <Link className="button-secondary" href={quotesRoute}>
          Back to Quotes
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Quote Summary</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${quoteCase.status}`}>{formatLabel(quoteCase.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Travel Dates</dt>
              <dd>{formatDateRange(quoteCase.startDate, quoteCase.endDate)}</dd>
            </div>
            <div>
              <dt>Pax</dt>
              <dd>{quoteCase.estimatedPax ?? "Not set"}</dd>
            </div>
            <div>
              <dt>Public Total</dt>
              <dd>
                {latestVersion
                  ? `${latestVersion.currency} ${latestVersion.publicTotalAmount.toLocaleString("en-US")}`
                  : "Not set"}
              </dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Request Action</h2>
          <QuoteRequestActions quoteCaseId={quoteCase.id} tourName={quoteCase.tourName} />
        </article>
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Request Thread</h2>
            <p>Requests and replies stay attached to this JHT tour code for revisions and booking follow-up.</p>
          </div>
          <span>{quoteCase.requestTimeline.length} requests</span>
        </div>
        {quoteCase.requestTimeline.length > 0 ? (
          <section className="table-shell" aria-label="Agency quote request thread">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {quoteCase.requestTimeline.map((request) => (
                  <tr key={request.id}>
                    <td>{formatDateTime(request.createdAt)}</td>
                    <td>{formatLabel(request.inquiryType)}</td>
                    <td>
                      <span className={`status-dot status-${request.status}`}>{formatLabel(request.status)}</span>
                    </td>
                    <td>{request.title}</td>
                    <td>{formatAgencyRequestPayload(request.requestPayload)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="subtext">No revision or booking request has been submitted for this tour code yet.</p>
        )}
      </section>

      {quoteCase.versions.length > 0 ? (
        quoteCase.versions.map((version) => (
          <FinalQuotation quoteCase={quoteCase} version={version} key={version.id} />
        ))
      ) : (
        <section className="empty-state">
          <h2>No public versions</h2>
          <p>JHT will send a quote version before itinerary details appear here.</p>
        </section>
      )}

      <section className="notice">
        <h2>Customer-safe boundary</h2>
        <ul className="clean-list">
          <li>This page reads only sent, accepted, or superseded quote versions.</li>
          <li>Supplier costs, internal totals, margins, and quote item internals are not requested.</li>
          <li>Booking and revision requests are saved as agency inquiries for JHT review.</li>
        </ul>
      </section>
    </>
  );
}

function FinalQuotation({
  quoteCase,
  version
}: {
  quoteCase: AgencyQuoteDetail;
  version: AgencyQuoteDetail["versions"][number];
}) {
  const summaryEntries = Object.entries(version.agencyVisibleSummary ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  const coverBlocks = version.presentationBlocks.filter((block) => !block.quoteItineraryDayId);

  return (
    <section className="final-quote section-block">
      <div className="final-quote-cover">
        <div>
          <p className="eyebrow">Final Quotation</p>
          <h2>{quoteCase.tourName}</h2>
          <p>
            {quoteCase.caseCode} / Version {version.versionNo} / {formatLabel(version.status)}
          </p>
        </div>
        <div className="quote-total-box">
          <span>Total Quotation</span>
          <strong>
            {version.currency} {version.publicTotalAmount.toLocaleString("en-US")}
          </strong>
        </div>
      </div>

      {summaryEntries.length > 0 ? (
        <section className="quote-summary-grid" aria-label="Quotation summary">
          {summaryEntries.map(([key, value]) => (
            <div key={key}>
              <dt>{formatLabel(key)}</dt>
              <dd>{stringValue(value)}</dd>
            </div>
          ))}
        </section>
      ) : null}

      <AgencyPresentationGrid blocks={coverBlocks} />

      {version.publicFareOptions.length > 0 ? (
        <section className="table-shell" aria-label={`Version ${version.versionNo} fare options`}>
          <table>
            <thead>
              <tr>
                <th>Option</th>
                <th>Hotel</th>
                <th>Fare</th>
                <th>Single Supp.</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {version.publicFareOptions.map((option, index) => (
                <tr key={`${version.id}-fare-${index}`}>
                  <td>{stringValue(option.optionName) || `Option ${index + 1}`}</td>
                  <td>{stringValue(option.hotelName) || stringValue(option.proposedHotel) || "-"}</td>
                  <td>{stringValue(option.tourFare) || stringValue(option.farePerPerson) || "-"}</td>
                  <td>{stringValue(option.singleSupplement) || "-"}</td>
                  <td>{stringValue(option.notes) || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="quote-itinerary">
        <div className="section-heading">
          <h2>Itinerary</h2>
          <span>{version.itineraryDays.length} days</span>
        </div>
        {version.itineraryDays.map((day) => (
          <article className="quote-day-card" key={day.id}>
            <div>
              <span className="badge">Day {day.dayNo}</span>
              <h3>{day.title ?? "Itinerary"}</h3>
              <p className="subtext">{day.serviceDate ?? "Date not set"}</p>
            </div>
            {day.publicDescription ? <p>{day.publicDescription}</p> : null}
            <MealSummary mealSummary={day.mealSummary} />
            {day.routeSegments.length > 0 ? (
              <ul className="clean-list">
                {day.routeSegments.map((segment) => (
                  <li key={segment.id}>
                    {segment.originLabel} to {segment.destinationLabel}
                    <span className="subtext">
                      {segment.travelMinutes ? `${segment.travelMinutes} min` : "Time not set"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <AgencyPresentationGrid blocks={day.presentationBlocks} />
          </article>
        ))}
      </section>

      {version.termsAndConditions ? (
        <section className="quote-terms">
          <h2>Terms & Conditions</h2>
          <p>{version.termsAndConditions}</p>
        </section>
      ) : null}
    </section>
  );
}

function MealSummary({ mealSummary }: { mealSummary: Record<string, unknown> }) {
  const meals = ["breakfast", "lunch", "dinner"]
    .map((key) => ({ key, value: stringValue(mealSummary[key]) }))
    .filter((meal) => meal.value);

  if (meals.length === 0) return null;

  return (
    <dl className="meal-summary">
      {meals.map((meal) => (
        <div key={meal.key}>
          <dt>{formatLabel(meal.key)}</dt>
          <dd>{meal.value}</dd>
        </div>
      ))}
    </dl>
  );
}

async function loadQuoteCase(shareId: string): Promise<LoadState> {
  const { headerStore, authorization } = await getPageAuthorization();
  if (!authorization) {
    const preview = getPreviewQuoteDetail(shareId);
    if (preview) return { status: "ready", quoteCase: preview };
    return { status: "auth-required", message: "This page requires an active agency user JWT." };
  }

  const response = await fetch(buildInternalApiUrl(`/api/agency/quote-cases/${shareId}`, headerStore), {
    headers: { authorization },
    cache: "no-store"
  });
  const payload = await response.json();

  if (!response.ok) {
    const preview = getPreviewQuoteDetail(shareId);
    if ((response.status === 401 || response.status === 403 || response.status === 404) && preview) {
      return { status: "ready", quoteCase: preview };
    }
    if (response.status === 404) return { status: "not-found", message: payload.error ?? "Quote not found" };
    return {
      status: response.status === 401 || response.status === 403 ? "auth-required" : "error",
      message: payload.error ?? "Unknown quote detail API error"
    };
  }

  return { status: "ready", quoteCase: mapQuoteDetail(payload.data) };
}

function getPreviewQuoteDetail(shareId: string): AgencyQuoteDetail | null {
  if (shareId !== "preview-quote-mhdm") return null;

  return {
    id: "preview-quote-mhdm",
    caseCode: "MY-WORLDTRAV-20260629",
    shareId: "preview-quote-mhdm",
    tourName: "MHDM Seoul 4N group",
    tourType: "incentive_tour",
    status: "sent",
    currency: "MYR",
    estimatedPax: 26,
    startDate: "2026-03-24",
    endDate: "2026-03-28",
    createdAt: "2026-06-29T09:00:00+09:00",
    requestTimeline: [
      {
        id: "preview-request-1",
        inquiryType: "new_quote",
        title: "MHDM Seoul 4N group",
        status: "received",
        requestPayload: {
          message: "4 nights Seoul incentive group with hotel, meals, attractions, guide, and coach."
        },
        createdAt: "2026-06-29T09:00:00+09:00"
      }
    ],
    versions: [
      {
        id: "preview-version-2",
        versionNo: 2,
        status: "sent",
        currency: "MYR",
        agencyVisibleSummary: {
          group: "MHDM Seoul 4N group",
          pax: "26 adults",
          period: "24-28 March 2026",
          hotel: "Seoul 4-star business hotel or similar"
        },
        publicFareOptions: [
          {
            optionName: "Seoul 4N Package",
            hotelName: "Seoul 4-star business hotel or similar",
            tourFare: "MYR 6,120 per pax",
            singleSupplement: "MYR 1,080",
            notes: "Based on 26 paying pax, twin sharing, private coach, guide, meals, and attractions."
          }
        ],
        publicTotalAmount: 183740,
        termsAndConditions:
          "Fare is based on the proposed group size and final availability. Hotel, meals, attractions, and vehicle are subject to final confirmation. Full payment must be completed before invoice deadline.",
        sentAt: "2026-06-29T09:30:00+09:00",
        acceptedAt: null,
        presentationBlocks: [
          {
            id: "preview-cover-desc",
            quoteItineraryDayId: null,
            blockType: "description",
            displayContext: "cover",
            title: "Seoul Incentive Program",
            description:
              "Customer-safe quotation preview with hotel, meal, attraction, vehicle, and guide inclusions summarized for partner review.",
            imageStoragePath: null,
            imageUrl: null,
            altText: null,
            sortOrder: 1,
            metadata: {}
          }
        ],
        itineraryDays: [
          makePreviewItineraryDay(1, "2026-03-24", "Arrival Seoul", "Arrival assistance, private coach transfer, city orientation, and hotel check-in.", {
            dinner: "Confirmed dinner menu"
          }),
          makePreviewItineraryDay(2, "2026-03-25", "Seoul city tour", "Gyeongbokgung Palace, Bukchon Hanok Village, Insadong, and N Seoul Tower photo stop.", {
            breakfast: "Hotel breakfast",
            lunch: "Bibimbap set",
            dinner: "Korean BBQ"
          }),
          makePreviewItineraryDay(3, "2026-03-26", "Business visit and incentive dinner", "Corporate visit, team building program, banquet setup, and private dinner.", {
            breakfast: "Hotel breakfast",
            lunch: "Conference lunch",
            dinner: "Private banquet dinner"
          }),
          makePreviewItineraryDay(4, "2026-03-27", "Shopping and leisure", "Cosmetic shop, ginseng center, Hongdae free time, and flexible coach standby.", {
            breakfast: "Hotel breakfast",
            dinner: "Seafood hotpot"
          }),
          makePreviewItineraryDay(5, "2026-03-28", "Departure", "Hotel check-out, airport transfer, luggage support, and departure assistance.", {
            breakfast: "Hotel breakfast"
          })
        ]
      }
    ]
  };
}

function makePreviewItineraryDay(
  dayNo: number,
  serviceDate: string,
  title: string,
  publicDescription: string,
  mealSummary: Record<string, unknown>
) {
  return {
    id: `preview-day-${dayNo}`,
    dayNo,
    serviceDate,
    title,
    mealSummary,
    publicDescription,
    routeSegments: [],
    presentationBlocks: []
  };
}

function mapQuoteDetail(row: any): AgencyQuoteDetail {
  const mapBlock = (block: any): AgencyQuotePresentationBlock => ({
    id: block.id,
    quoteItineraryDayId: block.quote_itinerary_day_id ?? null,
    blockType: block.block_type,
    displayContext: block.display_context,
    title: block.title ?? null,
    description: block.description ?? null,
    imageStoragePath: block.image_storage_path ?? null,
    imageUrl: block.image_url ?? null,
    altText: block.alt_text ?? null,
    sortOrder: block.sort_order,
    metadata: block.metadata ?? {}
  });

  return {
    id: row.id,
    caseCode: row.case_code,
    shareId: row.share_id,
    tourName: row.tour_name,
    tourType: row.tour_type ?? null,
    status: row.status,
    currency: row.currency,
    estimatedPax: row.estimated_pax ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    createdAt: row.created_at,
    requestTimeline: (row.request_timeline ?? []).map((request: any) => ({
      id: request.id,
      inquiryType: request.inquiry_type,
      title: request.title,
      status: request.status,
      requestPayload: request.request_payload ?? {},
      createdAt: request.created_at
    })),
    versions: (row.versions ?? []).map((version: any) => {
      const presentationBlocks: AgencyQuotePresentationBlock[] = (version.quote_presentation_blocks ?? []).map(mapBlock);
      const currency = version.currency ?? row.currency;
      const publicTotalAmount = convertKrwToQuoteCurrency(
        Number(version.public_total_amount ?? 0),
        Number(version.exchange_rate_to_krw ?? 1),
        currency
      );

      return {
        id: version.id,
        versionNo: version.version_no,
        status: version.status,
        currency,
        agencyVisibleSummary: version.agency_visible_summary ?? {},
        publicFareOptions: Array.isArray(version.public_fare_options) ? version.public_fare_options : [],
        publicTotalAmount,
        termsAndConditions: version.terms_and_conditions ?? null,
        sentAt: version.sent_at ?? null,
        acceptedAt: version.accepted_at ?? null,
        presentationBlocks,
        itineraryDays: (version.quote_itinerary_days ?? []).map((day: any) => ({
          id: day.id,
          dayNo: day.day_no,
          serviceDate: day.service_date ?? null,
          title: day.title ?? null,
          mealSummary: day.meal_summary ?? {},
          publicDescription: day.public_description ?? null,
          presentationBlocks: presentationBlocks.filter(
            (block: AgencyQuotePresentationBlock) => block.quoteItineraryDayId === day.id
          ),
          routeSegments: (day.route_segments ?? []).map((segment: any) => ({
            id: segment.id,
            seq: segment.seq,
            originLabel: segment.origin_label,
            destinationLabel: segment.destination_label,
            travelMinutes: segment.travel_minutes ?? null,
            distanceMeters: segment.distance_meters ?? null,
            provider: segment.provider
          }))
        }))
      };
    })
  };
}

function AgencyPresentationGrid({ blocks }: { blocks: AgencyQuotePresentationBlock[] }) {
  const publicBlocks = blocks.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  if (publicBlocks.length === 0) return null;

  return (
    <div className="presentation-grid">
      {publicBlocks.map((block) => (
        <article className="presentation-card" key={block.id}>
          {block.imageUrl ? <img alt={block.altText ?? block.title ?? "Quote image"} src={block.imageUrl} /> : null}
          {!block.imageUrl && block.imageStoragePath ? <div className="image-placeholder">{block.imageStoragePath}</div> : null}
          <div>
            <span className="subtext">{formatLabel(block.displayContext)}</span>
            <h3>{block.title ?? formatLabel(block.blockType)}</h3>
            {block.description ? <p>{block.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function buildInternalApiUrl(path: string, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  return new URL(path, `${protocol}://${host}`);
}

function formatDateRange(start: string | null, end: string | null) {
  if (start && end) return `${start} - ${end}`;
  if (start) return `From ${start}`;
  if (end) return `Until ${end}`;
  return "Not set";
}

function formatDateTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function formatAgencyRequestPayload(payload: Record<string, unknown>) {
  const message = typeof payload.message === "string" ? payload.message : "";
  const reference = typeof payload.agency_reference_no === "string" ? `Ref: ${payload.agency_reference_no}` : "";
  return [message, reference].filter(Boolean).join(" / ") || "Payload recorded";
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
