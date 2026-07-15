import type { Route } from "next";
import Link from "next/link";
import { QuoteExportRetryAction } from "@/components/admin/QuoteExportRetryAction";
import { QuoteItineraryDayCreateForm } from "@/components/admin/QuoteItineraryDayCreateForm";
import { QuoteItemCreateForm } from "@/components/admin/QuoteItemCreateForm";
import { QuotePresentationBlockCreateForm } from "@/components/admin/QuotePresentationBlockCreateForm";
import { QuoteVersionCreateAction } from "@/components/admin/QuoteVersionCreateAction";
import { QuoteVersionExportAction } from "@/components/admin/QuoteVersionExportAction";
import { QuoteVersionPublicSummaryForm } from "@/components/admin/QuoteVersionPublicSummaryForm";
import { ReservationCreateFromQuoteAction } from "@/components/admin/ReservationCreateFromQuoteAction";
import { QuoteVersionStatusActions } from "@/components/admin/QuoteVersionStatusActions";
import { RouteSegmentCreateForm } from "@/components/admin/RouteSegmentCreateForm";
import { searchCostItems } from "@/features/costing/queries";
import type { CostSearchItem } from "@/features/costing/types";
import { getQuoteCaseDetail } from "@/features/quotation/queries";
import type { QuoteCaseDetail, QuotePresentationBlockDetail, QuoteVersionDetail } from "@/features/quotation/types";
import { classifyPageDataError, getInternalPageContext } from "@/lib/api/server-page-context";

export const dynamic = "force-dynamic";

type PageParams = Promise<{ quoteCaseId: string }>;

type LoadState =
  | { status: "ready"; quoteCase: QuoteCaseDetail; costItems: CostSearchItem[] }
  | { status: "auth-required"; message: string }
  | { status: "not-found"; message: string }
  | { status: "error"; message: string };

const quoteCasesRoute = "/admin/quote-cases" as Route;
const costSearchRoute = "/admin/costing/search" as Route;

export default async function AdminQuoteCaseDetailPage({ params }: { params: PageParams }) {
  const { quoteCaseId } = await params;
  const loadState = await loadQuoteCase(quoteCaseId);

  if (loadState.status !== "ready") {
    return (
      <>
        <div className="page-header">
          <div>
            <p className="eyebrow">Internal Admin</p>
            <h1>Quote Case Detail</h1>
            <p>Internal quote versions, cost snapshots, public totals, and margins.</p>
          </div>
          <Link className="button-secondary" href={quoteCasesRoute}>
            Back to Quotes
          </Link>
        </div>
        <section className={`notice ${loadState.status === "error" ? "danger" : "warning"}`}>
          <h2>{loadState.status === "not-found" ? "Quote case not found" : "Quote case could not load"}</h2>
          <p>{loadState.message}</p>
        </section>
      </>
    );
  }

  const quoteCase = loadState.quoteCase;
  const costItems = loadState.costItems;
  const latestVersion = quoteCase.versions[0] ?? null;
  const editableVersion = quoteCase.versions.find((version) => version.status === "draft") ?? null;
  const acceptedVersion = quoteCase.versions.find((version) => version.status === "accepted") ?? null;

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>{quoteCase.caseCode}</h1>
          <p>{quoteCase.tourName}</p>
        </div>
        <Link className="button-secondary" href={quoteCasesRoute}>
          Back to Quotes
        </Link>
      </div>

      <section className="detail-grid">
        <article className="panel">
          <h2>Case Summary</h2>
          <dl className="definition-list">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-dot status-${quoteCase.status}`}>{formatLabel(quoteCase.status)}</span>
              </dd>
            </div>
            <div>
              <dt>Agency</dt>
              <dd>{quoteCase.agencyName ?? quoteCase.agencyAccountId}</dd>
            </div>
            <div>
              <dt>Travel Dates</dt>
              <dd>{formatDateRange(quoteCase.startDate, quoteCase.endDate)}</dd>
            </div>
            <div>
              <dt>Share ID</dt>
              <dd>{quoteCase.shareId}</dd>
            </div>
          </dl>
        </article>
        <article className="panel">
          <h2>Latest Totals</h2>
          {latestVersion ? (
            <dl className="definition-list">
              <div>
                <dt>Public Total</dt>
                <dd>
                  {latestVersion.currency} {latestVersion.publicTotalAmount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Internal Cost</dt>
                <dd>KRW {latestVersion.internalTotalCostKrw.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Internal Margin</dt>
                <dd>KRW {latestVersion.internalTotalMarginKrw.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Margin Mode</dt>
                <dd>{formatLabel(latestVersion.marginMode)}</dd>
              </div>
            </dl>
          ) : (
            <p>No versions yet.</p>
          )}
        </article>
      </section>

      <section className="action-band">
        <div>
          <h2>Costing Workspace</h2>
          <p>Use supplier cost search to prepare snapshot items before creating the next quote version.</p>
        </div>
        <Link className="button-primary" href={costSearchRoute}>
          Search Costs
        </Link>
      </section>

      <section className="action-band">
        <div>
          <h2>Reservation Conversion</h2>
          <p>Convert the accepted quote version into an internal reservation request for operations follow-up.</p>
        </div>
        <ReservationCreateFromQuoteAction
          acceptedQuoteVersionId={acceptedVersion?.id ?? null}
          endDate={quoteCase.endDate}
          quoteCaseId={quoteCase.id}
          startDate={quoteCase.startDate}
        />
      </section>

      <section className="action-band">
        <div>
          <h2>Revision Version</h2>
          <p>Create a new draft version by copying the latest version's itinerary, route segments, and item snapshots.</p>
        </div>
        <QuoteVersionCreateAction
          disabledReason={editableVersion ? `Draft version ${editableVersion.versionNo} already exists.` : undefined}
          quoteCaseId={quoteCase.id}
        />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Add Quote Item Snapshot</h2>
            <p>
              Add internal supplier-cost snapshots to the latest draft version. Saved items update public totals and
              internal margin immediately.
            </p>
          </div>
          {editableVersion ? <span>Version {editableVersion.versionNo}</span> : <span>No draft version</span>}
        </div>
        <QuoteItemCreateForm
          costItems={costItems}
          disabledReason={editableVersion ? undefined : "Create or open a draft quote version before adding items."}
          itineraryDays={editableVersion?.itineraryDays ?? []}
          quoteCaseId={quoteCase.id}
          quoteVersionId={editableVersion?.id ?? null}
        />
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Tour Code Request Thread</h2>
            <p>New, revision, and booking requests tied to this tour code are collected here for one-screen review.</p>
          </div>
          <span>{quoteCase.requestTimeline.length} requests</span>
        </div>
        {quoteCase.requestTimeline.length > 0 ? (
          <section className="table-shell" aria-label="Quote request timeline">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Title</th>
                  <th>Request / Reply Payload</th>
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
                    <td>
                      <pre className="json-preview compact-json">{JSON.stringify(request.requestPayload, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <p className="subtext">No agency request history is attached to this tour code yet.</p>
        )}
      </section>

      <section className="panel-section">
        <div className="section-heading">
          <div>
            <h2>Add Itinerary Day</h2>
            <p>Add customer-visible itinerary rows to the latest draft version before sending it to the agency.</p>
          </div>
          {editableVersion ? <span>Version {editableVersion.versionNo}</span> : <span>No draft version</span>}
        </div>
        <QuoteItineraryDayCreateForm
          disabledReason={editableVersion ? undefined : "Create or open a draft quote version before adding itinerary days."}
          nextDayNo={editableVersion ? editableVersion.itineraryDays.length + 1 : 1}
          quoteVersionId={editableVersion?.id ?? null}
        />
      </section>

      {quoteCase.versions.length > 0 ? (
        quoteCase.versions.map((version) => <QuoteVersionSection key={version.id} version={version} />)
      ) : (
        <section className="empty-state">
          <h2>No versions found</h2>
          <p>Create a quote version with snapshot items to continue.</p>
        </section>
      )}

      <section className="notice">
        <h2>Internal-only data</h2>
        <ul className="clean-list">
          <li>This admin page may read quote_items, supplier cost snapshots, and margin totals.</li>
          <li>Agency Portal quote pages must continue to use only public version summaries and route data.</li>
          <li>Domestic Supplier costs remain separated from Overseas Agency-visible records.</li>
        </ul>
      </section>
    </>
  );
}

function QuoteVersionSection({ version }: { version: QuoteVersionDetail }) {
  return (
    <section className="section-block">
      <div className="section-heading">
        <div>
          <h2>Version {version.versionNo}</h2>
          <span>{formatLabel(version.status)}</span>
        </div>
        <QuoteVersionStatusActions
          publicTotalAmount={version.publicTotalAmount}
          quoteVersionId={version.id}
          status={version.status}
        />
        <QuoteVersionExportAction
          publicTotalAmount={version.publicTotalAmount}
          quoteVersionId={version.id}
          status={version.status}
        />
      </div>
      <section className="action-band compact">
        <div>
          <h2>Excel Export Queue</h2>
          <p>Queue a DB snapshot-based XLSX export for this quote version without exposing costs to Agency Portal.</p>
        </div>
        {version.exports.length > 0 ? (
          <span className={`status-dot status-${version.exports[0].status}`}>
            Latest: {formatLabel(version.exports[0].status)}
          </span>
        ) : (
          <span className="status-dot">No exports</span>
        )}
      </section>
      <section className="panel section-block">
        <h2>Public Quotation Sheet</h2>
        {version.publicFareOptions.length > 0 ? (
          <section className="table-shell" aria-label={`Quote version ${version.versionNo} public fare options`}>
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
        ) : (
          <p className="subtext">No public fare options have been recorded yet.</p>
        )}
        <QuoteVersionPublicSummaryForm
          agencyVisibleSummary={version.agencyVisibleSummary}
          disabled={!["draft", "review"].includes(version.status)}
          excelSourceSummary={version.excelSourceSummary}
          publicFareOptions={version.publicFareOptions}
          quoteVersionId={version.id}
          termsAndConditions={version.termsAndConditions}
        />
      </section>
      <section className="panel section-block">
        <h2>Presentation Images And Descriptions</h2>
        <p className="subtext">
          Customer-safe hotel, meal, attraction, and itinerary image blocks for the partner-facing quote.
        </p>
        <PresentationBlockGrid blocks={version.presentationBlocks} />
        <QuotePresentationBlockCreateForm
          disabled={!["draft", "review"].includes(version.status)}
          itineraryDays={version.itineraryDays}
          quoteVersionId={version.id}
        />
      </section>
      {version.exports.length > 0 ? (
        <section className="table-shell" aria-label={`Quote version ${version.versionNo} exports`}>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Storage Path</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {version.exports.map((exportItem) => (
                <tr key={exportItem.id}>
                  <td>{exportItem.exportType.toUpperCase()}</td>
                  <td>
                    <span className={`status-dot status-${exportItem.status}`}>{formatLabel(exportItem.status)}</span>
                    {exportItem.errorMessage ? <span className="subtext">{exportItem.errorMessage}</span> : null}
                  </td>
                  <td>{exportItem.storagePath ?? "Pending"}</td>
                  <td>{formatDateTime(exportItem.createdAt)}</td>
                  <td>
                    <QuoteExportRetryAction exportId={exportItem.id} status={exportItem.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
      <section className="metric-row">
        <article className="metric-card">
          <span>Public Total</span>
          <strong>{version.publicTotalAmount.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Internal Cost</span>
          <strong>{version.internalTotalCostKrw.toLocaleString()}</strong>
        </article>
        <article className="metric-card">
          <span>Margin</span>
          <strong>{version.internalTotalMarginKrw.toLocaleString()}</strong>
        </article>
      </section>
      <section className="table-shell" aria-label={`Quote version ${version.versionNo} items`}>
        <table>
          <thead>
            <tr>
              <th>Excel Ref.</th>
              <th>Section</th>
              <th>Item</th>
              <th>Supplier</th>
              <th>Unit Cost</th>
              <th>Qty/Pax</th>
              <th>Cost KRW</th>
              <th>Sell</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            {version.items.map((item) => (
              <tr key={item.id}>
                <td>
                  {item.excelCellRef ?? "-"}
                  <span className="subtext">{formatLabel(item.calculationMode)}</span>
                  {item.manualOverride ? <span className="subtext">Manual override</span> : null}
                </td>
                <td>
                  {formatLabel(item.serviceSection)}
                  <span className="subtext">{item.excelFormula ?? "Formula not recorded"}</span>
                </td>
                <td>
                  <strong>{item.snapshotItemName}</strong>
                  <span className="subtext">{formatLabel(item.itemCategory)}</span>
                  {item.internalNotes ? <span className="subtext">{item.internalNotes}</span> : null}
                  {Object.keys(item.supplierCostBreakdown).length > 0 ? (
                    <pre className="json-preview compact-json">{JSON.stringify(item.supplierCostBreakdown, null, 2)}</pre>
                  ) : null}
                </td>
                <td>{item.snapshotSupplierName ?? "Snapshot only"}</td>
                <td>
                  {item.snapshotCostCurrency} {item.snapshotUnitCostAmount.toLocaleString()}
                </td>
                <td>
                  {item.quantity.toLocaleString()} / {item.paxCount ?? "n/a"}
                  <span className="subtext">{formatLabel(item.pricingUnit)}</span>
                </td>
                <td>{item.totalCostKrw.toLocaleString()}</td>
                <td>{item.totalSellAmount.toLocaleString()}</td>
                <td>{(item.totalSellAmount - item.totalCostKrw).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {version.itineraryDays.length > 0 ? (
        <section className="panel section-block">
          <h2>Itinerary Days</h2>
          <ul className="clean-list">
            {version.itineraryDays.map((day) => (
              <li key={day.id}>
                Day {day.dayNo}: {day.title ?? "Untitled"}
                <span className="subtext">
                  {day.serviceDate ?? "Date not set"}
                  {day.internalNotes ? ` - ${day.internalNotes}` : ""}
                </span>
                {day.publicDescription ? <span className="subtext">{day.publicDescription}</span> : null}
                {day.routeSegments.length > 0 ? (
                  <ul className="clean-list nested-list">
                    {day.routeSegments
                      .slice()
                      .sort((left, right) => left.seq - right.seq)
                      .map((segment) => (
                        <li key={segment.id}>
                          {segment.seq}. {segment.originLabel} to {segment.destinationLabel}
                          <span className="subtext">
                            {segment.travelMinutes !== null ? `${segment.travelMinutes} min` : "Time not set"}
                            {segment.distanceMeters !== null ? ` / ${segment.distanceMeters} m` : ""}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : null}
                <RouteSegmentCreateForm
                  disabled={version.status !== "draft"}
                  itineraryDayId={day.id}
                  nextSeq={day.routeSegments.length + 1}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function PresentationBlockGrid({ blocks }: { blocks: QuotePresentationBlockDetail[] }) {
  const publicBlocks = blocks.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  if (publicBlocks.length === 0) {
    return <p className="subtext">No presentation blocks have been added yet.</p>;
  }

  return (
    <div className="presentation-grid">
      {publicBlocks.map((block) => (
        <article className="presentation-card" key={block.id}>
          {block.imageUrl ? <img alt={block.altText ?? block.title ?? "Quote presentation image"} src={block.imageUrl} /> : null}
          {!block.imageUrl && block.imageStoragePath ? (
            <div className="image-placeholder">{block.imageStoragePath}</div>
          ) : null}
          <div>
            <span className="subtext">
              {formatLabel(block.displayContext)} / {formatLabel(block.blockType)}
              {block.isPublic ? "" : " / Internal"}
            </span>
            <h3>{block.title ?? "Untitled block"}</h3>
            {block.description ? <p>{block.description}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

async function loadQuoteCase(quoteCaseId: string): Promise<LoadState> {
  try {
    const { supabase } = await getInternalPageContext();
    const [quoteCase, costItems] = await Promise.all([
      getQuoteCaseDetail(supabase, quoteCaseId),
      searchCostItems(supabase, { limit: 80 })
    ]);
    if (!quoteCase) return { status: "not-found", message: "Quote case not found" };
    return { status: "ready", quoteCase, costItems };
  } catch (error) {
    return classifyPageDataError(error);
  }
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
