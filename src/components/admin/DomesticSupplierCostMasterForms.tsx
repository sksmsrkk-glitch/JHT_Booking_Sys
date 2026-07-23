/**
 * @file 한글 책임: `Domestic Supplier Cost Master Forms` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { LocaleDateInput } from "@/components/LocaleDateInput";
import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useMemo, useState } from "react";
import type { CompanyListItem } from "@/features/company/types";
import { SUPPLIER_CATEGORIES } from "@/features/supplier/queries";

type CostMasterKind = "hotel" | "vehicle" | "restaurant" | "attraction" | "guide" | "other" | "incentive_banquet";

type CreatedItem = {
  id: string;
  supplier: string;
  product: string;
  category: string;
  unit: string;
  amount: number;
  region: string | null;
  tags: string[];
};

const COST_MASTER_KINDS: { value: CostMasterKind; label: string; summary: string }[] = [
  { value: "hotel", label: "Hotel", summary: "Rooms, breakfast, banquet rooms, facilities, weekday/weekend prices" },
  { value: "vehicle", label: "Vehicle", summary: "Supplier vehicles, from-to route fares, overtime fees" },
  { value: "restaurant", label: "Meal", summary: "Restaurant menus, dietary tags, pax capacity" },
  { value: "attraction", label: "Attraction", summary: "Tickets, operation hours, experience/history/performance tags" },
  { value: "guide", label: "Guide", summary: "Shopping/non-shopping guide day rates and guide category" },
  { value: "other", label: "Other Cost", summary: "Luggage truck, KTX, flights, ad hoc local costs" },
  { value: "incentive_banquet", label: "Incentive Banquet", summary: "Venue capacity, menu price, AV/facility checkboxes" }
];

const FACILITY_OPTIONS = ["Beam projector", "LED projector", "PA System", "Microphone", "Stage", "Podium"];
const DIETARY_OPTIONS = ["Halal", "Non Halal", "Vegetarian", "Vegan", "Seafood", "Chicken", "Beef"];
const ATTRACTION_TAGS = ["Experience", "History", "Performance", "Team building", "Theme park", "Museum"];
const TICKET_AUDIENCE_PRICE_FIELDS = [
  { key: "adult", label: "Adult", field: "ticketAdultPrice" },
  { key: "child", label: "Child", field: "ticketChildPrice" },
  { key: "group", label: "Group", field: "ticketGroupPrice" },
  { key: "all", label: "All", field: "ticketAllPrice" }
];
const CLOSED_DAY_OPTIONS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Public holiday"];

/**
 * 공급사 종류마다 서로 다른 필수 필드와 반복 가격 행을 하나의 생성 흐름으로 조립합니다.
 * 화면에서 만든 메뉴·티켓·기간별 가격은 평면 문자열이 아니라 서버가 검증할 구조화 payload로 변환합니다.
 */
export function CostMasterQuickCreateForm({
  companies,
  initialKind = "hotel",
  initialMenuRows = 1,
  initialAttractionRows = 1
}: {
  companies: CompanyListItem[];
  initialKind?: CostMasterKind;
  initialMenuRows?: number;
  initialAttractionRows?: number;
}) {
  const [kind, setKind] = useState<CostMasterKind>(initialKind);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const activeKind = useMemo(() => COST_MASTER_KINDS.find((item) => item.value === kind)!, [kind]);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");

    try {
      const companyId = text(formData, "companyId");
      if (!companyId) throw new Error("Company is required.");

      const category = mapSupplierCategory(kind);
      const supplierName = readSupplierName(formData, kind);
      if (!supplierName) throw new Error("Supplier or item name is required.");

      const supplier = await postJson("/api/domestic-suppliers", {
        companyId,
        category,
        nameKo: supplierName,
        nameEn: text(formData, "nameEn"),
        searchKeywords: buildSearchKeywords(formData, kind),
        regionLevel1: text(formData, "regionLevel1"),
        regionLevel2: text(formData, "regionLevel2"),
        address: text(formData, "address"),
        phone: text(formData, "phone"),
        website: text(formData, "website"),
        internalNotes: buildSupplierNotes(formData, kind)
      });

      const productSpecs = buildProductSpecs(formData, kind);
      if (productSpecs.length === 0) throw new Error("At least one cost item amount is required.");

      let savedPrices = 0;
      let savedImages = 0;
      const mediaItems = buildMediaItems(formData);
      const mediaFiles = formData.getAll("imageFile").filter((value): value is File => value instanceof File && value.size > 0);
      for (const spec of productSpecs) {
        const product = await postJson(`/api/domestic-suppliers/${supplier.id}/products`, {
          productType: spec.productType,
          nameKo: spec.name,
          nameEn: spec.nameEn,
          searchName: spec.searchName,
          description: spec.description,
          capacity: spec.capacity,
          roomType: spec.roomType,
          breakfastIncluded: spec.breakfastIncluded,
          vehicleSeatCount: spec.vehicleSeatCount,
          menuTags: spec.tags
        });

        if (spec.amount !== null) {
          await postJson(`/api/supplier-products/${product.id}/prices`, {
            pricingUnit: spec.pricingUnit,
            currency: text(formData, "currency") || "KRW",
            costAmount: spec.amount,
            minPax: numberOrNull(formData, "minPax"),
            maxPax: numberOrNull(formData, "maxPax"),
            seasonLabel: spec.seasonLabel,
            validFrom: text(formData, "validFrom"),
            validTo: text(formData, "validTo"),
            weekdayRule: spec.weekdayRule,
            includesTax: text(formData, "includesTax") !== "false",
            notes: spec.priceNotes
          });
          savedPrices += 1;
        }

        if (mediaItems.length > 0 || mediaFiles.length > 0) {
          const savedMedia = await postMedia(`/api/supplier-products/${product.id}/media`, mediaItems, mediaFiles);
          savedImages += Array.isArray(savedMedia) ? savedMedia.length : mediaItems.length + mediaFiles.length;
        }
      }

      setMessage(`Saved ${productSpecs.length} item(s), ${savedPrices} price row(s), ${savedImages} image link(s). Refreshing...`);
      requestRouteRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cost master save failed.");
      setIsBusy(false);
    }
  }

  return (
    <form action={submit} className="cost-master-form">
      <div className="cost-master-tabs" aria-label="Cost master type">
        {COST_MASTER_KINDS.map((item) => (
          <a
            className={item.value === kind ? "active" : ""}
            href={`/admin/domestic-suppliers?costKind=${item.value}`}
            key={item.value}
            onClick={(event) => {
              if (isBusy) {
                event.preventDefault();
                return;
              }
              event.preventDefault();
              setKind(item.value);
            }}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="cost-master-note">
        <strong>{activeKind.label}</strong>
        <span>{activeKind.summary}</span>
      </div>

      <div className="form-grid three-column">
        <CompanySelect companies={companies} disabled={isBusy} />
        <label>
          Currency
          <input defaultValue="KRW" disabled={isBusy} name="currency" />
        </label>
        <label>
          Tax
          <select defaultValue="true" disabled={isBusy} name="includesTax">
            <option value="true">Includes tax</option>
            <option value="false">Excludes tax</option>
          </select>
        </label>
        <label>
          Region 1
          <input disabled={isBusy} name="regionLevel1" placeholder="Seoul, Busan, Jeju" />
        </label>
        <label>
          Region 2
          <input disabled={isBusy} name="regionLevel2" placeholder="Gangnam, Haeundae" />
        </label>
        <label>
          Address
          <input disabled={isBusy} name="address" />
        </label>
        <label>
          Valid From
          <LocaleDateInput disabled={isBusy} name="validFrom" />
        </label>
        <label>
          Valid To
          <LocaleDateInput disabled={isBusy} name="validTo" />
        </label>
        <label>
          Pax Range
          <span className="inline-inputs">
            <input disabled={isBusy} min="1" name="minPax" placeholder="Min" type="number" />
            <input disabled={isBusy} min="1" name="maxPax" placeholder="Max" type="number" />
          </span>
        </label>
      </div>

      {renderKindFields(kind, isBusy, initialMenuRows, initialAttractionRows)}
      <ItemImageInputs disabled={isBusy} />

      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Save Cost Master
        </button>
        {message ? <span className={message.startsWith("Saved") ? "success-text" : "danger-text"}>{message}</span> : null}
      </div>
    </form>
  );
}

/** 검색 결과, 선택 상품의 가격 규칙, 이미지 및 세부 스펙을 같은 공급사 경계 안에서 표시합니다. */
export function CostMasterSearchPanel() {
  const [items, setItems] = useState<CreatedItem[]>([]);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function search(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const params = new URLSearchParams();
    const q = text(formData, "q");
    const category = text(formData, "category");
    const region = text(formData, "region");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (region) params.set("region", region);
    params.set("limit", "30");

    const response = await safeFetch(`/api/cost-items/search?${params.toString()}`);
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Search failed.");
      setIsBusy(false);
      return;
    }

    const mapped = (result.data ?? []).map((row: any) => {
      const firstPrice = (row.supplier_prices ?? [])[0];
      return {
        id: row.id,
        supplier: row.domestic_suppliers?.name_ko ?? "Unknown supplier",
        product: row.name_ko,
        category: row.domestic_suppliers?.category ?? row.product_type,
        unit: firstPrice?.pricing_unit ?? "No price",
        amount: Number(firstPrice?.cost_amount ?? 0),
        region: row.domestic_suppliers?.region_level1 ?? null,
        tags: row.menu_tags ?? []
      };
    });
    setItems(mapped);
    setMessage(mapped.length === 0 ? "No matching cost items." : "");
    setIsBusy(false);
  }

  return (
    <div className="cost-search-panel">
      <form action={search} className="toolbar">
        <label>
          Keyword
          <input name="q" placeholder="hotel, bibimbap, KTX, guide" type="search" />
        </label>
        <label>
          Category
          <select name="category">
            <option value="">All</option>
            {SUPPLIER_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {formatLabel(category)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Region
          <input name="region" placeholder="Seoul" />
        </label>
        <button className="button-secondary" disabled={isBusy} type="submit">
          Search Items
        </button>
      </form>
      {message ? <p className="subtext">{message}</p> : null}
      {items.length > 0 ? (
        <div className="table-shell nested">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Item</th>
                <th>Category</th>
                <th>Region</th>
                <th>Price</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.supplier}</td>
                  <td>{item.product}</td>
                  <td>{formatLabel(item.category)}</td>
                  <td>{item.region ?? "Any"}</td>
                  <td>
                    {item.unit === "No price" ? item.unit : `${formatLabel(item.unit)} / ${item.amount.toLocaleString()}`}
                  </td>
                  <td>{item.tags.join(", ") || "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function renderKindFields(
  kind: CostMasterKind,
  isBusy: boolean,
  initialMenuRows: number,
  initialAttractionRows: number
) {
  if (kind === "hotel") {
    return (
      <div className="cost-master-section">
        <div className="form-grid three-column">
          <label>
            Hotel Name
            <input disabled={isBusy} name="hotelName" required />
          </label>
          <label>
            Hotel Basic Info
            <input disabled={isBusy} name="hotelInfo" placeholder="Grade, location, notes" />
          </label>
          <label>
            Room Type
            <input disabled={isBusy} name="roomType" placeholder="Twin, Double, Suite" />
          </label>
          <label>
            Room Price
            <input disabled={isBusy} min="0" name="roomPrice" step="0.01" type="number" />
          </label>
          <label>
            Breakfast Price
            <input disabled={isBusy} min="0" name="breakfastPrice" step="0.01" type="number" />
          </label>
          <label>
            Banquet Room
            <input disabled={isBusy} name="banquetName" />
          </label>
          <label>
            Banquet Capacity
            <input disabled={isBusy} min="0" name="banquetCapacity" type="number" />
          </label>
          <label>
            Banquet Price
            <input disabled={isBusy} min="0" name="banquetPrice" step="0.01" type="number" />
          </label>
          <label>
            Facility Price
            <input disabled={isBusy} min="0" name="facilityPrice" step="0.01" type="number" />
          </label>
          <label>
            Season / Period
            <input disabled={isBusy} name="seasonLabel" placeholder="Peak, Low, 2026 Autumn" />
          </label>
          <label>
            Weekday Rule
            <select disabled={isBusy} name="weekdayRule">
              <option value="">All days</option>
              <option value="weekday">Weekday</option>
              <option value="weekend">Weekend</option>
              <option value="holiday">Holiday</option>
            </select>
          </label>
        </div>
        <CheckboxGroup disabled={isBusy} label="Banquet Facilities" name="facilityTags" options={FACILITY_OPTIONS} />
      </div>
    );
  }

  if (kind === "vehicle") {
    return (
      <div className="cost-master-section form-grid three-column">
        <label>
          Vehicle Supplier
          <input disabled={isBusy} name="vehicleSupplierName" required />
        </label>
        <label>
          Vehicle Type
          <input disabled={isBusy} name="vehicleType" placeholder="Sedan, Van, 45-seat bus" required />
        </label>
        <label>
          Seat Count
          <input disabled={isBusy} min="1" name="vehicleSeatCount" type="number" />
        </label>
        <label>
          From
          <input disabled={isBusy} name="fromRegion" placeholder="ICN, Seoul" />
        </label>
        <label>
          To
          <input disabled={isBusy} name="toRegion" placeholder="Hotel, Busan" />
        </label>
        <label>
          Route Price
          <input disabled={isBusy} min="0" name="routePrice" step="0.01" type="number" />
        </label>
        <label>
          Extra Hour Fee
          <input disabled={isBusy} min="0" name="overtimeFee" step="0.01" type="number" />
        </label>
      </div>
    );
  }

  if (kind === "restaurant") {
    return (
      <div className="cost-master-section">
        <div className="form-grid three-column">
          <label>
            Restaurant Name
            <input disabled={isBusy} name="restaurantName" required />
          </label>
          <label>
            Restaurant Info
            <input disabled={isBusy} name="restaurantInfo" />
          </label>
          <TimeRangeFields disabled={isBusy} label="Operation Hours" prefix="restaurant" />
          <label>
            Capacity
            <input disabled={isBusy} min="0" name="capacity" type="number" />
          </label>
          <label>
            Special Dietary Info
            <input disabled={isBusy} name="specialDietary" placeholder="No pork, vegan set, allergy notes" />
          </label>
        </div>
        <RestaurantMenuTable disabled={isBusy} initialRows={initialMenuRows} />
        <CheckboxGroup disabled={isBusy} label="Menu Tags" name="menuTags" options={DIETARY_OPTIONS} />
      </div>
    );
  }

  if (kind === "attraction") {
    return (
      <div className="cost-master-section">
        <div className="form-grid three-column">
          <label>
            Attraction Name
            <input disabled={isBusy} name="attractionName" required />
          </label>
          <TimeRangeFields disabled={isBusy} label="Operation Hours" prefix="attraction" />
        </div>
        <AttractionTicketTable disabled={isBusy} initialRows={initialAttractionRows} />
        <CheckboxGroup disabled={isBusy} label="Attraction Tags" name="attractionTags" options={ATTRACTION_TAGS} />
      </div>
    );
  }

  if (kind === "guide") {
    return (
      <div className="cost-master-section form-grid three-column">
        <label>
          Guide Name
          <input disabled={isBusy} name="guideName" required />
        </label>
        <label>
          Guide Type
          <select disabled={isBusy} name="guideType">
            <option value="in-house">In-house</option>
            <option value="freelancer">Freelancer</option>
          </select>
        </label>
        <label>
          Shopping Tour Day Cost
          <input disabled={isBusy} min="0" name="shoppingGuideCost" step="0.01" type="number" />
        </label>
        <label>
          Non-shopping Day Cost
          <input disabled={isBusy} min="0" name="nonShoppingGuideCost" step="0.01" type="number" />
        </label>
      </div>
    );
  }

  if (kind === "incentive_banquet") {
    return (
      <div className="cost-master-section">
        <div className="form-grid three-column">
          <label>
            Venue / Hotel Name
            <input disabled={isBusy} name="venueName" required />
          </label>
          <label>
            Banquet Room
            <input disabled={isBusy} name="banquetName" required />
          </label>
          <label>
            Capacity
            <input disabled={isBusy} min="0" name="banquetCapacity" type="number" />
          </label>
          <label>
            Room Rental Price
            <input disabled={isBusy} min="0" name="banquetPrice" step="0.01" type="number" />
          </label>
          <label>
            Menu
            <input disabled={isBusy} name="menuName" />
          </label>
          <label>
            Menu Price
            <input disabled={isBusy} min="0" name="menuPrice" step="0.01" type="number" />
          </label>
          <label>
            Facility Price
            <input disabled={isBusy} min="0" name="facilityPrice" step="0.01" type="number" />
          </label>
        </div>
        <CheckboxGroup disabled={isBusy} label="Included / Available Facilities" name="facilityTags" options={FACILITY_OPTIONS} />
      </div>
    );
  }

  return (
    <div className="cost-master-section form-grid three-column">
      <label>
        Supplier / Vendor
        <input disabled={isBusy} name="otherSupplierName" placeholder="KTX, luggage truck, airline" required />
      </label>
      <label>
        Cost Item
        <input disabled={isBusy} name="otherItemName" required />
      </label>
      <label>
        Category Tag
        <input disabled={isBusy} name="otherTag" placeholder="luggage truck, KTX, flight" />
      </label>
      <label>
        Price
        <input disabled={isBusy} min="0" name="otherPrice" step="0.01" type="number" />
      </label>
    </div>
  );
}

function CheckboxGroup({
  disabled,
  label,
  name,
  options
}: {
  disabled: boolean;
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <fieldset className="checkbox-cluster">
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option}>
          <input disabled={disabled} name={name} type="checkbox" value={option} />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

function TimeRangeFields({ disabled, label, prefix }: { disabled: boolean; label: string; prefix: string }) {
  return (
    <div className="time-range-fields">
      <span>{label}</span>
      <div className="inline-inputs">
        <label>
          Open
          <input disabled={disabled} name={`${prefix}OpenTime`} type="time" />
        </label>
        <label>
          Close
          <input disabled={disabled} name={`${prefix}CloseTime`} type="time" />
        </label>
      </div>
      <fieldset className="mini-checkbox-cluster">
        <legend>Closed Days</legend>
        {CLOSED_DAY_OPTIONS.map((day) => (
          <label key={day}>
            <input disabled={disabled} name={`${prefix}ClosedDays`} type="checkbox" value={day} />
            {day}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function ItemImageInputs({ disabled }: { disabled: boolean }) {
  const [rows, setRows] = useState([{ id: "image-1" }]);

  return (
    <div className="key-value-editor image-attachment-editor">
      <div className="split-row">
        <div>
          <h3>Item Images</h3>
          <p className="subtext">Upload image files or attach an existing Storage Path / Image URL. Maximum 10 images, 8 MB each.</p>
        </div>
        <button
          className="button-secondary"
          disabled={disabled || rows.length >= 10}
          onClick={() => setRows((current) => [...current, { id: `image-${Date.now()}-${current.length}` }])}
          type="button"
        >
          Add Image
        </button>
      </div>
      <div className="table-shell nested">
        <table className="key-value-table image-attachment-table">
          <thead>
            <tr>
              <th>Upload</th>
              <th>Storage Path</th>
              <th>Image URL</th>
              <th>Label</th>
              <th>Alt Text</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input accept="image/*" disabled={disabled} name="imageFile" type="file" />
                </td>
                <td>
                  <input disabled={disabled} name="imageStoragePath" placeholder="supplier-media/item/image.jpg" />
                </td>
                <td>
                  <input disabled={disabled} name="imageUrl" placeholder="https://..." type="url" />
                </td>
                <td>
                  <input disabled={disabled} name="imageLabel" placeholder="Exterior, menu, room, ticket" />
                </td>
                <td>
                  <input disabled={disabled} name="imageAlt" placeholder="Customer-safe image description" />
                </td>
                <td>
                  <button
                    className="button-secondary"
                    disabled={disabled || rows.length === 1}
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="subtext">DB and API also enforce the 10-image maximum per supplier item.</p>
    </div>
  );
}

function RestaurantMenuTable({ disabled, initialRows }: { disabled: boolean; initialRows: number }) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: Math.max(1, initialRows) }, (_, index) => ({ id: `menu-${index + 1}` }))
  );
  const addMenuHref = `/admin/domestic-suppliers?costKind=restaurant&menuRows=${rows.length + 1}`;

  return (
    <div className="key-value-editor">
      <div className="split-row">
        <div>
          <h3>Menu Price Table</h3>
          <p className="subtext">Each row is saved as one searchable menu item with its own price.</p>
        </div>
        <a
          className="button-secondary"
          aria-disabled={disabled}
          href={addMenuHref}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            setRows((current) => [...current, { id: `menu-${Date.now()}-${current.length}` }]);
          }}
        >
          Add Menu
        </a>
      </div>
      <div className="table-shell nested">
        <table className="key-value-table">
          <thead>
            <tr>
              <th>Menu Item</th>
              <th>Price</th>
              <th>Notes / Option</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <input disabled={disabled} name="menuName" placeholder="Bibimbap set, BBQ buffet" required={index === 0} />
                </td>
                <td>
                  <input disabled={disabled} min="0" name="menuPrice" placeholder="0" required={index === 0} step="0.01" type="number" />
                </td>
                <td>
                  <input disabled={disabled} name="menuNote" placeholder="Lunch, dinner, child price, drink included" />
                </td>
                <td>
                  <button
                    className="button-secondary"
                    disabled={disabled || rows.length === 1}
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttractionTicketTable({ disabled, initialRows }: { disabled: boolean; initialRows: number }) {
  const [rows, setRows] = useState(() =>
    Array.from({ length: Math.max(1, initialRows) }, (_, index) => ({ id: `ticket-${index + 1}` }))
  );
  const addTicketHref = `/admin/domestic-suppliers?costKind=attraction&attractionRows=${rows.length + 1}`;

  return (
    <div className="key-value-editor">
      <div className="split-row">
        <div>
          <h3>Ticket Price Table</h3>
          <p className="subtext">
            One ticket row can hold adult, child, student, senior, group, or all-audience prices.
          </p>
        </div>
        <a
          aria-disabled={disabled}
          className="button-secondary"
          href={addTicketHref}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            setRows((current) => [...current, { id: `ticket-${Date.now()}-${current.length}` }]);
          }}
        >
          Add Ticket
        </a>
      </div>
      <div className="table-shell nested">
        <table className="key-value-table ticket-price-table">
          <thead>
            <tr>
              <th>Ticket / Program</th>
              <th>Adult</th>
              <th>Child</th>
              <th>Group</th>
              <th>All</th>
              <th>Conditions / Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>
                  <input disabled={disabled} name="ticketName" placeholder="General admission, show, combo pass" required={index === 0} />
                </td>
                {TICKET_AUDIENCE_PRICE_FIELDS.map((audience, audienceIndex) => (
                  <td key={audience.key}>
                    <input
                      disabled={disabled}
                      min="0"
                      name={audience.field}
                      placeholder="0"
                      required={index === 0 && audienceIndex === 0}
                      step="0.01"
                      type="number"
                    />
                  </td>
                ))}
                <td>
                  <input disabled={disabled} name="ticketNote" placeholder="Weekend, night, 20+pax, includes activity" />
                </td>
                <td>
                  <button
                    className="button-secondary"
                    disabled={disabled || rows.length === 1}
                    onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanySelect({ companies, disabled }: { companies: CompanyListItem[]; disabled: boolean }) {
  return (
    <label>
      Company
      <select disabled={disabled} name="companyId" required>
        <option value="">Select company</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.code} - {company.nameKo}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildProductSpecs(formData: FormData, kind: CostMasterKind) {
  const seasonLabel = text(formData, "seasonLabel");
  const weekdayRule = text(formData, "weekdayRule");
  const specs: ProductSpec[] = [];

  if (kind === "hotel") {
    pushSpec(specs, {
      productType: "room",
      name: text(formData, "roomType") || `${text(formData, "hotelName")} room`,
      amount: numberOrNull(formData, "roomPrice"),
      pricingUnit: "per_room",
      searchName: joinSearch([text(formData, "hotelName"), text(formData, "roomType"), "hotel room"]),
      description: text(formData, "hotelInfo"),
      roomType: text(formData, "roomType"),
      breakfastIncluded: false,
      seasonLabel,
      weekdayRule,
      tags: ["hotel", "room"]
    });
    pushSpec(specs, {
      productType: "meal",
      name: `${text(formData, "hotelName")} breakfast`,
      amount: numberOrNull(formData, "breakfastPrice"),
      pricingUnit: "per_person",
      searchName: joinSearch([text(formData, "hotelName"), "breakfast"]),
      description: "Hotel breakfast cost",
      breakfastIncluded: true,
      seasonLabel,
      weekdayRule,
      tags: ["breakfast"]
    });
    pushSpec(specs, {
      productType: "meeting_room",
      name: text(formData, "banquetName") || `${text(formData, "hotelName")} banquet`,
      amount: numberOrNull(formData, "banquetPrice"),
      pricingUnit: "per_group",
      searchName: joinSearch([text(formData, "hotelName"), text(formData, "banquetName"), "banquet meeting room"]),
      description: joinSearch([text(formData, "hotelInfo"), checkboxValues(formData, "facilityTags").join(", ")]),
      capacity: numberOrNull(formData, "banquetCapacity"),
      seasonLabel,
      weekdayRule,
      tags: checkboxValues(formData, "facilityTags")
    });
    pushSpec(specs, {
      productType: "other",
      name: `${text(formData, "hotelName")} banquet facilities`,
      amount: numberOrNull(formData, "facilityPrice"),
      pricingUnit: "per_group",
      searchName: joinSearch([text(formData, "hotelName"), checkboxValues(formData, "facilityTags").join(" ")]),
      description: "Banquet facility package",
      seasonLabel,
      weekdayRule,
      tags: checkboxValues(formData, "facilityTags")
    });
  }

  if (kind === "vehicle") {
    const route = joinSearch([text(formData, "fromRegion"), "to", text(formData, "toRegion")]);
    pushSpec(specs, {
      productType: "vehicle",
      name: joinSearch([text(formData, "vehicleType"), route]) || text(formData, "vehicleType"),
      amount: numberOrNull(formData, "routePrice"),
      pricingUnit: "per_vehicle",
      searchName: joinSearch([text(formData, "vehicleSupplierName"), text(formData, "vehicleType"), route]),
      description: `Route fare: ${route || "route not set"}`,
      vehicleSeatCount: numberOrNull(formData, "vehicleSeatCount"),
      tags: ["vehicle", text(formData, "fromRegion"), text(formData, "toRegion")].filter(Boolean)
    });
    pushSpec(specs, {
      productType: "vehicle",
      name: `${text(formData, "vehicleType")} extra hour`,
      amount: numberOrNull(formData, "overtimeFee"),
      pricingUnit: "per_vehicle",
      searchName: joinSearch([text(formData, "vehicleSupplierName"), text(formData, "vehicleType"), "extra hour overtime"]),
      description: "Additional use time fee. Current DB stores this under per_vehicle with notes.",
      vehicleSeatCount: numberOrNull(formData, "vehicleSeatCount"),
      priceNotes: "Extra usage hour fee",
      tags: ["vehicle", "overtime"]
    });
  }

  if (kind === "restaurant") {
    const menuNames = stringValues(formData, "menuName");
    const menuPrices = stringValues(formData, "menuPrice");
    const menuNotes = stringValues(formData, "menuNote");

    menuNames.forEach((menuName, index) => {
      pushSpec(specs, {
        productType: "meal",
        name: menuName,
        amount: numberFromValue(menuPrices[index]),
        pricingUnit: "per_person",
        searchName: joinSearch([text(formData, "restaurantName"), menuName, checkboxValues(formData, "menuTags").join(" ")]),
        description: joinSearch([
          text(formData, "restaurantInfo"),
          operationHoursSummary(formData, "restaurant"),
          text(formData, "specialDietary"),
          menuNotes[index] ? `Menu note: ${menuNotes[index]}` : ""
        ]),
        capacity: numberOrNull(formData, "capacity"),
        priceNotes: menuNotes[index] || null,
        tags: checkboxValues(formData, "menuTags")
      });
    });
  }

  if (kind === "attraction") {
    const ticketNames = stringValues(formData, "ticketName");
    const ticketNotes = stringValues(formData, "ticketNote");
    const ticketPriceColumns = Object.fromEntries(
      TICKET_AUDIENCE_PRICE_FIELDS.map((audience) => [audience.field, stringValues(formData, audience.field)])
    ) as Record<string, string[]>;

    ticketNames.forEach((ticketName, index) => {
      TICKET_AUDIENCE_PRICE_FIELDS.forEach((audience) => {
        const ticketPrices = ticketPriceColumns[audience.field] ?? [];
        pushSpec(specs, {
          productType: "ticket",
          name: joinSearch([text(formData, "attractionName"), ticketName, audience.label]),
          amount: numberFromValue(ticketPrices[index]),
          pricingUnit: "per_person",
          searchName: joinSearch([
            text(formData, "attractionName"),
            ticketName,
            audience.label,
            ticketNotes[index],
            checkboxValues(formData, "attractionTags").join(" ")
          ]),
        description: joinSearch([
          operationHoursSummary(formData, "attraction") || "Operation hours: Not set",
          `Audience: ${audience.label}`,
          ticketNotes[index] ? `Ticket note: ${ticketNotes[index]}` : ""
          ]),
          seasonLabel: audience.label,
          priceNotes: ticketNotes[index] || null,
          tags: [audience.key, ...checkboxValues(formData, "attractionTags")]
        });
      });
    });
  }

  if (kind === "guide") {
    pushSpec(specs, {
      productType: "guide_service",
      name: `${text(formData, "guideName")} shopping tour`,
      amount: numberOrNull(formData, "shoppingGuideCost"),
      pricingUnit: "per_guide",
      searchName: joinSearch([text(formData, "guideName"), "shopping guide", text(formData, "guideType")]),
      description: "Guide one-day cost for shopping tour",
      seasonLabel: "shopping tour",
      tags: [text(formData, "guideType"), "shopping tour"].filter(Boolean)
    });
    pushSpec(specs, {
      productType: "guide_service",
      name: `${text(formData, "guideName")} non-shopping tour`,
      amount: numberOrNull(formData, "nonShoppingGuideCost"),
      pricingUnit: "per_guide",
      searchName: joinSearch([text(formData, "guideName"), "non-shopping guide", text(formData, "guideType")]),
      description: "Guide one-day cost for non-shopping tour",
      seasonLabel: "non-shopping tour",
      tags: [text(formData, "guideType"), "non-shopping tour"].filter(Boolean)
    });
  }

  if (kind === "other") {
    pushSpec(specs, {
      productType: "other",
      name: text(formData, "otherItemName"),
      amount: numberOrNull(formData, "otherPrice"),
      pricingUnit: "per_group",
      searchName: joinSearch([text(formData, "otherSupplierName"), text(formData, "otherItemName"), text(formData, "otherTag")]),
      description: text(formData, "otherTag"),
      tags: [text(formData, "otherTag")].filter(Boolean)
    });
  }

  if (kind === "incentive_banquet") {
    pushSpec(specs, {
      productType: "meeting_room",
      name: text(formData, "banquetName"),
      amount: numberOrNull(formData, "banquetPrice"),
      pricingUnit: "per_group",
      searchName: joinSearch([text(formData, "venueName"), text(formData, "banquetName"), "incentive banquet"]),
      description: checkboxValues(formData, "facilityTags").join(", "),
      capacity: numberOrNull(formData, "banquetCapacity"),
      tags: checkboxValues(formData, "facilityTags")
    });
    pushSpec(specs, {
      productType: "meal",
      name: text(formData, "menuName") || `${text(formData, "banquetName")} menu`,
      amount: numberOrNull(formData, "menuPrice"),
      pricingUnit: "per_person",
      searchName: joinSearch([text(formData, "venueName"), text(formData, "menuName"), "banquet menu"]),
      description: "Incentive banquet menu",
      capacity: numberOrNull(formData, "banquetCapacity"),
      tags: ["banquet menu"]
    });
    pushSpec(specs, {
      productType: "other",
      name: `${text(formData, "banquetName")} facilities`,
      amount: numberOrNull(formData, "facilityPrice"),
      pricingUnit: "per_group",
      searchName: joinSearch([text(formData, "venueName"), checkboxValues(formData, "facilityTags").join(" ")]),
      description: "Incentive banquet facility package",
      tags: checkboxValues(formData, "facilityTags")
    });
  }

  return specs;
}

type ProductSpec = {
  productType: string;
  name: string;
  amount: number | null;
  pricingUnit: string;
  searchName: string;
  description?: string | null;
  capacity?: number | null;
  roomType?: string | null;
  breakfastIncluded?: boolean | null;
  vehicleSeatCount?: number | null;
  nameEn?: string | null;
  seasonLabel?: string | null;
  weekdayRule?: string | null;
  priceNotes?: string | null;
  tags?: string[];
};

function pushSpec(specs: ProductSpec[], spec: ProductSpec) {
  const hasName = spec.name.trim().length > 0;
  const hasAmount = spec.amount !== null;
  if (hasName && hasAmount) specs.push({ ...spec, searchName: spec.searchName || spec.name });
}

function mapSupplierCategory(kind: CostMasterKind) {
  if (kind === "hotel" || kind === "incentive_banquet") return "hotel";
  if (kind === "restaurant") return "restaurant";
  if (kind === "vehicle") return "vehicle";
  if (kind === "attraction") return "attraction";
  if (kind === "guide") return "guide";
  return "other";
}

function readSupplierName(formData: FormData, kind: CostMasterKind) {
  if (kind === "hotel") return text(formData, "hotelName");
  if (kind === "vehicle") return text(formData, "vehicleSupplierName");
  if (kind === "restaurant") return text(formData, "restaurantName");
  if (kind === "attraction") return text(formData, "attractionName");
  if (kind === "guide") return text(formData, "guideName");
  if (kind === "incentive_banquet") return text(formData, "venueName");
  return text(formData, "otherSupplierName");
}

function buildSearchKeywords(formData: FormData, kind: CostMasterKind) {
  return joinSearch([
    readSupplierName(formData, kind),
    text(formData, "regionLevel1"),
    text(formData, "regionLevel2"),
    text(formData, "roomType"),
    text(formData, "vehicleType"),
    text(formData, "menuName"),
    text(formData, "ticketName"),
    text(formData, "otherTag"),
    checkboxValues(formData, "menuTags").join(" "),
    checkboxValues(formData, "attractionTags").join(" "),
    checkboxValues(formData, "facilityTags").join(" ")
  ]);
}

function buildSupplierNotes(formData: FormData, kind: CostMasterKind) {
  return joinSearch([
    `Manual cost master: ${kind}`,
    text(formData, "hotelInfo"),
    text(formData, "restaurantInfo"),
    operationHoursSummary(formData, "restaurant"),
    operationHoursSummary(formData, "attraction"),
    text(formData, "ticketName"),
    text(formData, "specialDietary"),
    text(formData, "fromRegion") && text(formData, "toRegion")
      ? `Route ${text(formData, "fromRegion")} to ${text(formData, "toRegion")}`
      : ""
  ]);
}

function operationHoursSummary(formData: FormData, prefix: string) {
  const open = text(formData, `${prefix}OpenTime`);
  const close = text(formData, `${prefix}CloseTime`);
  const closedDays = checkboxValues(formData, `${prefix}ClosedDays`);
  const hours = open && close ? `${open}-${close}` : open ? `From ${open}` : close ? `Until ${close}` : "";
  const closed = closedDays.length > 0 ? `Closed: ${closedDays.join(", ")}` : "";
  return joinSearch([hours ? `Operation hours: ${hours}` : "", closed]);
}

async function postJson(path: string, payload: Record<string, unknown>) {
  const response = await safeFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Save failed.");
  return result.data;
}

async function postMedia(path: string, mediaItems: ReturnType<typeof buildMediaItems>, files: File[]) {
  const body = new FormData();
  body.set("mediaItems", JSON.stringify(mediaItems));
  for (const file of files) body.append("files", file);
  const response = await safeFetch(path, { method: "POST", body });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Image upload failed.");
  return result.data;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function checkboxValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
}

function buildMediaItems(formData: FormData) {
  const storagePaths = stringValues(formData, "imageStoragePath");
  const imageUrls = stringValues(formData, "imageUrl");
  const labels = stringValues(formData, "imageLabel");
  const altTexts = stringValues(formData, "imageAlt");

  return storagePaths
    .map((storagePath, index) => ({
      storagePath,
      imageUrl: imageUrls[index] ?? "",
      publicLabel: labels[index] ?? "",
      altText: altTexts[index] ?? "",
      sortOrder: index + 1
    }))
    .filter((item) => item.storagePath || item.imageUrl)
    .slice(0, 10);
}

function stringValues(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value).trim());
}

function numberOrNull(formData: FormData, key: string) {
  const value = text(formData, key);
  return numberFromValue(value);
}

function numberFromValue(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function joinSearch(parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
