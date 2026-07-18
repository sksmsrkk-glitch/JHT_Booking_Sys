"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { Fragment, useEffect, useState } from "react";
import type { AgencyListItem } from "@/features/agency/types";
import type { CompanyListItem } from "@/features/company/types";
import { buildCurrencyOptions, DEFAULT_COUNTRY_REFERENCES, mergeCountryReferences } from "@/features/countries/defaults";

type QuoteItemRow = {
  id: string;
  sourceSupplierProductId: string | null;
  sourceSupplierPriceId: string | null;
  itineraryDayNo: string;
  searchKeyword: string;
  itemCategory: string;
  snapshotItemName: string;
  snapshotSupplierName: string;
  snapshotCostCurrency: string;
  snapshotUnitCostAmount: string;
  exchangeRateMode: "global" | "item";
  exchangeRateToKrw: string;
  calculationPreset: CalculationPreset;
  pricingUnit: string;
  quantity: string;
  paxCount: string;
  marginScope: "global" | "item";
  marginMode: "auto_rate" | "manual_total";
  marginRate: string;
  manualTotal: string;
  partnerVisibleNotes: string;
};

/*
 * 견적 작성 화면의 임시 row 모델입니다.
 *
 * 이 컴포넌트는 엑셀 견적서 업무 방식을 화면으로 옮긴 곳입니다.
 * 호텔/차량/식사/관광지/가이드/기타 항목을 Day별로 입력하고,
 * 공급사 원가 검색 -> 스냅샷 적용 -> 환율 적용 -> 마진 적용 -> 판매가 계산을 수행합니다.
 */
type ItineraryRow = {
  id: string;
  dayNo: string;
  serviceDate: string;
  cityArea: string;
  title: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  hotelName: string;
  remarks: string;
  publicDescription: string;
  internalNotes: string;
};

type QuoteExchangeRateRow = {
  id: string;
  countryCode: string;
  countryName: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  effectiveDate: string;
  sourceExchangeRateId: string | null;
  source: string;
  notes: string;
};

type QuoteCaseFields = {
  tourName: string;
  currency: string;
  estimatedPax: string;
  startDate: string;
  endDate: string;
  agencySummaryNotes: string;
  termsAndConditions: string;
};

type CalculationPreset =
  | "group_quantity"
  | "person_quantity"
  | "room_night"
  | "vehicle_day"
  | "guide_day"
  | "manual_total";

type CostSearchPrice = {
  id: string;
  pricing_unit: string;
  currency: string;
  cost_amount: number;
  min_pax: number | null;
  max_pax: number | null;
  season_label: string | null;
  status: string;
};

type CostSearchResult = {
  id: string;
  product_type: string;
  name_ko: string;
  name_en: string | null;
  search_name: string;
  domestic_suppliers: {
    id: string;
    category: string;
    name_ko: string;
    name_en: string | null;
    region_level1: string | null;
  };
  supplier_prices: CostSearchPrice[];
};

type SearchState = {
  isLoading: boolean;
  error: string;
  results: CostSearchResult[];
};

type ExchangeRateLookup = {
  id: string;
  countryCode: string | null;
  countryName: string | null;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  effectiveDate: string;
  source: string | null;
};

type CountryOption = {
  countryCode: string;
  countryName: string;
  defaultCurrency: string | null;
};

const FALLBACK_COUNTRIES: CountryOption[] = mergeCountryReferences(DEFAULT_COUNTRY_REFERENCES).map((country) => ({
  countryCode: country.countryCode,
  countryName: country.countryName,
  defaultCurrency: country.defaultCurrency
}));

// DB 연결 전 또는 로그인 전에도 국가 드롭다운이 비어 보이지 않도록 공통 국가 프리셋을 사용합니다.
// 실제 운영에서는 /api/countries와 country_references 테이블이 우선 기준입니다.
const DEFAULT_ITEM_ROW: QuoteItemRow = {
  id: "row-1",
  sourceSupplierProductId: null,
  sourceSupplierPriceId: null,
  itineraryDayNo: "1",
  searchKeyword: "",
  itemCategory: "other",
  snapshotItemName: "Sample service",
  snapshotSupplierName: "Domestic supplier snapshot",
  snapshotCostCurrency: "KRW",
  snapshotUnitCostAmount: "100000",
  exchangeRateMode: "global",
  exchangeRateToKrw: "1",
  calculationPreset: "group_quantity",
  pricingUnit: "per_group",
  quantity: "1",
  paxCount: "1",
  marginScope: "global",
  marginMode: "auto_rate",
  marginRate: "0.15",
  manualTotal: "",
  partnerVisibleNotes: ""
};

const DEFAULT_ITINERARY_ROW: ItineraryRow = {
  id: "day-1",
  dayNo: "1",
  serviceDate: "",
  cityArea: "Seoul",
  title: "Arrival and transfer",
  breakfast: "",
  lunch: "",
  dinner: "",
  hotelName: "",
  remarks: "",
  publicDescription: "Arrival support and transfer service.",
  internalNotes: ""
};

const DEFAULT_EXCHANGE_RATE_ROW: QuoteExchangeRateRow = {
  id: "fx-1",
  countryCode: "",
  countryName: "",
  baseCurrency: "USD",
  quoteCurrency: "KRW",
  rate: "1",
  effectiveDate: "",
  sourceExchangeRateId: null,
  source: "manual",
  notes: ""
};

const ITEM_CATEGORIES = ["hotel", "meal", "transport", "attraction", "guide", "other"];

const QUOTE_ITEM_SECTIONS = [
  {
    category: "hotel",
    label: "Hotel",
    description: "Rooms, nights, breakfast, single supplement, and hotel-related costing."
  },
  {
    category: "transport",
    label: "Vehicle / Transport",
    description: "Coach, van, car, airport transfer, parking, toll, and vehicle-day costing."
  },
  {
    category: "meal",
    label: "Meals",
    description: "Restaurant menus, meal counts, group meals, and per-person food costs."
  },
  {
    category: "attraction",
    label: "Attractions",
    description: "Tickets, entrance fees, activities, museums, theme parks, and tour inclusions."
  },
  {
    category: "guide",
    label: "Guide",
    description: "Guide days, assistant guide, interpretation, and guide-related service fees."
  },
  {
    category: "other",
    label: "Other",
    description: "Miscellaneous costs, manual adjustments, options, and special services."
  }
];

const CALCULATION_PRESETS: Array<{
  value: CalculationPreset;
  label: string;
  pricingUnit: string;
  quantityLabel: string;
  formulaLabel: string;
}> = [
  {
    value: "group_quantity",
    label: "Unit x Qty",
    pricingUnit: "per_group",
    quantityLabel: "Qty",
    formulaLabel: "unit cost x quantity"
  },
  {
    value: "person_quantity",
    label: "Pax x Qty",
    pricingUnit: "per_person",
    quantityLabel: "Times",
    formulaLabel: "unit cost x pax x quantity"
  },
  {
    value: "room_night",
    label: "Room/Night",
    pricingUnit: "per_room",
    quantityLabel: "Room nights",
    formulaLabel: "unit cost x room nights"
  },
  {
    value: "vehicle_day",
    label: "Vehicle/Day",
    pricingUnit: "per_vehicle",
    quantityLabel: "Vehicle days",
    formulaLabel: "unit cost x vehicle days"
  },
  {
    value: "guide_day",
    label: "Guide/Day",
    pricingUnit: "per_guide",
    quantityLabel: "Guide days",
    formulaLabel: "unit cost x guide days"
  },
  {
    value: "manual_total",
    label: "Manual Total",
    pricingUnit: "per_group",
    quantityLabel: "Qty",
    formulaLabel: "manual sell total"
  }
];

const DEFAULT_CASE_FIELDS: QuoteCaseFields = {
  tourName: "",
  currency: "KRW",
  estimatedPax: "",
  startDate: "",
  endDate: "",
  agencySummaryNotes: "",
  termsAndConditions: ""
};

// 엑셀 샘플은 USD 원가와 KRW 원가가 함께 있으므로 통화별 환율을 분리해서 적용합니다.
const EXCEL_SAMPLE_USD_TO_KRW = "1380.5";

const EXCEL_SAMPLE_CASE_FIELDS: QuoteCaseFields = {
  tourName: "6D 5N SEOUL + SKI RESORT [PRIVATE TOUR]",
  currency: "USD",
  estimatedPax: "55",
  startDate: "2026-10-12",
  endDate: "2026-10-17",
  agencySummaryNotes:
    "GROUP SIZE: 50-60 Pax\nPROPOSED HOTEL: Seoul - Bernoui Seoul or similar class\nTOUR FARE REFERENCE: TWN USD 345 per person / S-SUPP USD 220 per person\nSOURCE: Excel quotation sample - Thailand arrival 12 Oct 2026, 4N Seoul.",
  termsAndConditions:
    "INCLUDES\n- Accommodation based on twin sharing.\n- Sightseeing and transfer by Staria 11-seater vehicle with entrance fees as per itinerary.\n- Meals as specified in the itinerary.\n\nEXCLUDES\n- Guide and driver tipping: USD 6 or KRW 8,000 per person per day.\n- Airport taxes and air tickets.\n- Optional tours and personal expenses.\n\nCONDITIONS\n- Fare is based on the proposed group size. Reduction in group size requires re-quotation.\n- English and Thai speaking guide arrangement.\n- Validity: 12-17 October 2026.\n- Cancellation charge within 3 days before arrival: 100% of tour fare.\n- Full payment must be completed before the invoice deadline.\n- No booking or reservation has been made at quotation stage."
};

const EXCEL_SAMPLE_ITEMS: QuoteItemRow[] = [
  makeExcelSampleItem("sample-hotel", "1", "hotel", "Bernoui Seoul or similar class - twin room block", "Proposed Seoul hotel", "USD", "80", "room_night", "per_room", "110", "55", "Twin-sharing accommodation reference from quotation sheet."),
  makeExcelSampleItem("sample-vehicle", "1", "transport", "Staria 11-seater vehicle service", "Private vehicle supplier", "USD", "240", "vehicle_day", "per_vehicle", "6", "55", "Sightseeing and transfer vehicle basis from quotation sheet."),
  makeExcelSampleItem("sample-guide", "1", "guide", "English and Thai speaking guide", "Guide service", "USD", "180", "guide_day", "per_guide", "6", "55", "Guide language condition from quotation sheet."),
  makeExcelSampleItem("sample-meals-d1", "1", "meal", "Day 1 meals - pan fried spicy chicken / pork knuckle", "Restaurant package", "USD", "32", "person_quantity", "per_person", "1", "55", "Lunch and dinner sample menu from itinerary."),
  makeExcelSampleItem("sample-attraction-palace", "2", "attraction", "Gyeongbok Palace entrance", "Attraction cost master", "KRW", "3000", "person_quantity", "per_person", "1", "55", "Costing sheet attraction item."),
  makeExcelSampleItem("sample-attraction-hanbok", "2", "attraction", "Korean traditional costume experience", "Experience supplier", "KRW", "10000", "person_quantity", "per_person", "1", "55", "Costing sheet experience item."),
  makeExcelSampleItem("sample-attraction-nanta", "2", "attraction", "Nanta Show ticket", "Performance supplier", "KRW", "7000", "person_quantity", "per_person", "1", "55", "Costing sheet performance item."),
  makeExcelSampleItem("sample-attraction-sorak", "3", "attraction", "Mt Sorak National Park with cable car", "Attraction cost master", "KRW", "13500", "person_quantity", "per_person", "1", "55", "Costing sheet attraction item."),
  makeExcelSampleItem("sample-attraction-everland", "5", "attraction", "Everland with free pass", "Theme park supplier", "KRW", "22000", "person_quantity", "per_person", "1", "55", "Optional theme park reference from costing sheet."),
  makeExcelSampleItem("sample-other-tip", "6", "other", "Guide and driver tipping - excluded reference", "Guest direct payment", "USD", "6", "person_quantity", "per_person", "6", "55", "Excluded from tour fare unless manually included.")
];

const EXCEL_SAMPLE_ITINERARY: ItineraryRow[] = [
  {
    id: "sample-day-1",
    dayNo: "1",
    serviceDate: "2026-10-12",
    cityArea: "Incheon / Seoul",
    title: "Arrival Incheon / Seoul",
    breakfast: "",
    lunch: "Pan fried spicy chicken",
    dinner: "Pork knuckle",
    hotelName: "Bernoui Seoul or similar class",
    remarks: "Private tour arrival day.",
    publicDescription:
      "Arrival at Incheon International Airport, meet guide, transfer to Seoul, light sightseeing and hotel check-in.",
    internalNotes: "Use quotation sample: Thailand arrival 12 Oct 2026."
  },
  {
    id: "sample-day-2",
    dayNo: "2",
    serviceDate: "2026-10-13",
    cityArea: "Seoul",
    title: "Seoul city tour",
    breakfast: "Hotel",
    lunch: "Army stew",
    dinner: "Unlimited pork BBQ",
    hotelName: "Bernoui Seoul or similar class",
    remarks: "Palace, costume, performance day.",
    publicDescription:
      "Visit Gyeongbok Palace, enjoy Korean traditional costume experience, explore Seoul highlights, and attend Nanta Show.",
    internalNotes: "Items linked: palace, Hanbok, Nanta."
  },
  {
    id: "sample-day-3",
    dayNo: "3",
    serviceDate: "2026-10-14",
    cityArea: "Seoul / Mt Sorak",
    title: "Nature and cable car",
    breakfast: "Hotel",
    lunch: "Grilled fish set",
    dinner: "Ginseng chicken soup",
    hotelName: "Ski resort or similar class",
    remarks: "Mt Sorak cable car reference.",
    publicDescription:
      "Depart Seoul for a scenic day around Mt Sorak National Park with cable car experience and resort check-in.",
    internalNotes: "Costing sheet includes Mt Sorak National Park with cable car."
  },
  {
    id: "sample-day-4",
    dayNo: "4",
    serviceDate: "2026-10-15",
    cityArea: "Ski Resort / Seoul",
    title: "Ski resort experience",
    breakfast: "Hotel",
    lunch: "Local meal",
    dinner: "Korean BBQ",
    hotelName: "Bernoui Seoul or similar class",
    remarks: "Adjust program by season and weather.",
    publicDescription:
      "Enjoy ski resort activities, then return to Seoul with shopping and dinner arrangement.",
    internalNotes: ""
  },
  {
    id: "sample-day-5",
    dayNo: "5",
    serviceDate: "2026-10-16",
    cityArea: "Seoul",
    title: "Theme park or Seoul leisure",
    breakfast: "Hotel",
    lunch: "Bibimbap",
    dinner: "Farewell dinner",
    hotelName: "Bernoui Seoul or similar class",
    remarks: "Everland free pass shown as sample attraction option.",
    publicDescription:
      "Full-day theme park option such as Everland or Seoul leisure program, followed by farewell dinner.",
    internalNotes: "Everland with free pass appears in costing sheet."
  },
  {
    id: "sample-day-6",
    dayNo: "6",
    serviceDate: "2026-10-17",
    cityArea: "Seoul / Incheon",
    title: "Departure",
    breakfast: "Hotel",
    lunch: "",
    dinner: "",
    hotelName: "",
    remarks: "Airport transfer.",
    publicDescription:
      "Hotel breakfast, final shopping stop if time allows, and transfer to Incheon International Airport for departure.",
    internalNotes: "Quotation validity through 17 October 2026."
  }
];

function makeExcelSampleItem(
  id: string,
  itineraryDayNo: string,
  itemCategory: string,
  snapshotItemName: string,
  snapshotSupplierName: string,
  snapshotCostCurrency: string,
  snapshotUnitCostAmount: string,
  calculationPreset: CalculationPreset,
  pricingUnit: string,
  quantity: string,
  paxCount: string,
  partnerVisibleNotes: string
): QuoteItemRow {
  return {
    id,
    sourceSupplierProductId: null,
    sourceSupplierPriceId: null,
    itineraryDayNo,
    searchKeyword: snapshotItemName,
    itemCategory,
    snapshotItemName,
    snapshotSupplierName,
    snapshotCostCurrency,
    snapshotUnitCostAmount,
    exchangeRateMode: "item",
    exchangeRateToKrw: snapshotCostCurrency === "KRW" ? "1" : EXCEL_SAMPLE_USD_TO_KRW,
    calculationPreset,
    pricingUnit,
    quantity,
    paxCount,
    marginScope: "global",
    marginMode: "auto_rate",
    marginRate: "0.15",
    manualTotal: "",
    partnerVisibleNotes
  };
}

export function QuoteCaseCreateForm({
  agencies,
  companies
}: {
  agencies: AgencyListItem[];
  companies: CompanyListItem[];
}) {
  const [message, setMessage] = useState("");
  const [sampleNotice, setSampleNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [caseFields, setCaseFields] = useState<QuoteCaseFields>(DEFAULT_CASE_FIELDS);
  const [itemRows, setItemRows] = useState<QuoteItemRow[]>([DEFAULT_ITEM_ROW]);
  const [itineraryRows, setItineraryRows] = useState<ItineraryRow[]>([DEFAULT_ITINERARY_ROW]);
  const [exchangeRateRows, setExchangeRateRows] = useState<QuoteExchangeRateRow[]>([DEFAULT_EXCHANGE_RATE_ROW]);
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [globalExchangeRate, setGlobalExchangeRate] = useState("1");
  const [globalMarginRate, setGlobalMarginRate] = useState("0.15");
  const [exchangeRateNotice, setExchangeRateNotice] = useState("");
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>(FALLBACK_COUNTRIES);
  const itemDayGroups = buildItemDayGroups(itemRows, itineraryRows);
  const caseCurrencyOptions = buildCurrencyOptions(countryOptions, caseFields.currency);

  useEffect(() => {
    let mounted = true;
    safeFetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        setCountryOptions(
          mergeCountryReferences(payload.data).map((country) => ({
            countryCode: country.countryCode,
            countryName: country.countryName,
            defaultCurrency: country.defaultCurrency ?? null
          }))
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  async function createQuoteCase(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    setSampleNotice("");

    const normalizedItems = itemRows
      .filter((row) => row.snapshotItemName.trim())
      .map((row) => {
        const preset = getCalculationPreset(row.calculationPreset);
        const effectiveExchangeRate = getEffectiveExchangeRate(row, globalExchangeRate);
        const effectiveMargin = getEffectiveMargin(row, globalMarginRate);
        return {
          sourceSupplierProductId: row.sourceSupplierProductId,
          sourceSupplierPriceId: row.sourceSupplierPriceId,
          itineraryDayNo: normalizeOptionalNumber(row.itineraryDayNo),
          itemCategory: row.itemCategory,
          snapshotItemName: row.snapshotItemName.trim(),
          snapshotSupplierName: normalizeOptionalString(row.snapshotSupplierName),
          snapshotCostCurrency: row.snapshotCostCurrency.trim() || "KRW",
          snapshotUnitCostAmount: normalizeOptionalNumber(row.snapshotUnitCostAmount) ?? 0,
          exchangeRateToKrw: effectiveExchangeRate,
          pricingUnit: row.pricingUnit,
          quantity: normalizeOptionalNumber(row.quantity) ?? 1,
          paxCount: normalizeOptionalNumber(row.paxCount) ?? 1,
          margin:
            effectiveMargin.mode === "manual_total"
              ? { mode: "manual_total", manualTotal: normalizeOptionalNumber(row.manualTotal) ?? 0 }
              : { mode: "auto_rate", rate: effectiveMargin.rate },
          manualOverride: row.marginScope === "item" || row.marginMode === "manual_total" || row.exchangeRateMode === "item",
          partnerVisibleNotes: normalizeOptionalString(row.partnerVisibleNotes),
          calculationMode: row.marginMode === "manual_total" ? "manual_total" : "auto_formula",
          excelFormula: preset.formulaLabel,
          publicBreakdown: {
            calculationPreset: row.calculationPreset,
            formula: preset.formulaLabel,
            quantityLabel: preset.quantityLabel,
            itineraryDayNo: normalizeOptionalNumber(row.itineraryDayNo),
            exchangeRateMode: row.exchangeRateMode,
            marginScope: row.marginScope
          }
        };
      });

    if (normalizedItems.length === 0) {
      setMessage("Add at least one quote item.");
      setIsBusy(false);
      return;
    }

    const itineraryDays = itineraryRows
      .filter((row) => row.title.trim() || row.publicDescription.trim())
      .map((row) => ({
        dayNo: normalizeOptionalNumber(row.dayNo) ?? 1,
        serviceDate: normalizeOptionalString(row.serviceDate),
        title: normalizeOptionalString([row.cityArea, row.title].filter(Boolean).join(" - ")),
        mealSummary: {
          breakfast: normalizeOptionalString(row.breakfast),
          lunch: normalizeOptionalString(row.lunch),
          dinner: normalizeOptionalString(row.dinner),
          hotel: normalizeOptionalString(row.hotelName),
          cityArea: normalizeOptionalString(row.cityArea),
          remarks: normalizeOptionalString(row.remarks)
        },
        publicDescription: normalizeOptionalString(row.publicDescription),
        internalNotes: normalizeOptionalString([row.remarks, row.internalNotes].filter(Boolean).join("\n"))
      }));

    const payload = {
      companyId: String(formData.get("companyId") ?? "").trim(),
      agencyAccountId: String(formData.get("agencyAccountId") ?? "").trim(),
      tourName: String(formData.get("tourName") ?? "").trim(),
      tourType: normalizeOptionalString(formData.get("tourType")),
      currency: String(formData.get("currency") ?? "KRW").trim() || "KRW",
      estimatedPax: normalizeOptionalNumber(formData.get("estimatedPax")),
      startDate: normalizeOptionalString(formData.get("startDate")),
      endDate: normalizeOptionalString(formData.get("endDate")),
      marginMode: "auto_rate",
      defaultMarginRate: normalizeOptionalNumber(globalMarginRate) ?? 0,
      exchangeRateToKrw: normalizeOptionalNumber(globalExchangeRate) ?? 1,
      agencyVisibleSummary: {
        headline: String(formData.get("tourName") ?? "").trim(),
        notes: normalizeOptionalString(formData.get("agencySummaryNotes"))
      },
      termsAndConditions: normalizeOptionalString(formData.get("termsAndConditions")),
      exchangeRates: exchangeRateRows
        .filter((row) => row.baseCurrency.trim() && row.quoteCurrency.trim() && Number(row.rate) > 0)
        .map((row) => ({
          countryCode: normalizeOptionalString(row.countryCode),
          countryName: normalizeOptionalString(row.countryName),
          baseCurrency: row.baseCurrency.trim().toUpperCase(),
          quoteCurrency: row.quoteCurrency.trim().toUpperCase() || "KRW",
          rate: normalizeOptionalNumber(row.rate) ?? 1,
          effectiveDate: normalizeOptionalString(row.effectiveDate),
          sourceExchangeRateId: row.sourceExchangeRateId,
          source: normalizeOptionalString(row.source),
          notes: normalizeOptionalString(row.notes)
        })),
      items: normalizedItems,
      itineraryDays
    };

    const response = await safeFetch("/api/quote-cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Quote case creation failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={createQuoteCase} className="stacked-form">
      <div className="form-grid three-column">
        <label>
          Company
          <select name="companyId" required>
            <option value="">Select company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} - {company.nameKo}
              </option>
            ))}
          </select>
        </label>
        <label>
          Overseas Agency
          <select name="agencyAccountId" required>
            <option value="">Select agency</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tour Name
          <input
            name="tourName"
            placeholder="Seoul incentive tour"
            required
            value={caseFields.tourName}
            onChange={(event) => updateCaseField("tourName", event.target.value)}
          />
        </label>
        <label>
          Currency
          <select
            name="currency"
            value={caseFields.currency}
            onChange={(event) => updateCaseField("currency", event.target.value.toUpperCase())}
          >
            {caseCurrencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estimated Pax
          <input
            min="1"
            name="estimatedPax"
            placeholder="20"
            type="number"
            value={caseFields.estimatedPax}
            onChange={(event) => updateCaseField("estimatedPax", event.target.value)}
          />
        </label>
        <label>
          Default Margin Rate
          <input
            min="0"
            name="defaultMarginRate"
            step="0.01"
            type="number"
            value={globalMarginRate}
            onChange={(event) => setGlobalMarginRate(event.target.value)}
          />
        </label>
        <label>
          Start Date
          <input
            name="startDate"
            type="date"
            value={caseFields.startDate}
            onChange={(event) => updateCaseField("startDate", event.target.value)}
          />
        </label>
        <label>
          End Date
          <input
            name="endDate"
            type="date"
            value={caseFields.endDate}
            onChange={(event) => updateCaseField("endDate", event.target.value)}
          />
        </label>
        <label>
          Exchange Rate to KRW
          <input
            min="0"
            name="exchangeRateToKrw"
            step="0.000001"
            type="number"
            value={globalExchangeRate}
            onChange={(event) => setGlobalExchangeRate(event.target.value)}
          />
          <button className="button-secondary mini-button" onClick={() => applyCommonExchangeRate(caseFields.currency)} type="button">
            Apply Common FX
          </button>
        </label>
      </div>

      <label className="full-width-field">
        Agency Summary Notes
        <textarea
          name="agencySummaryNotes"
          placeholder="Customer-visible short summary"
          rows={3}
          value={caseFields.agencySummaryNotes}
          onChange={(event) => updateCaseField("agencySummaryNotes", event.target.value)}
        />
      </label>
      <label className="full-width-field">
        Terms and Conditions
        <textarea
          name="termsAndConditions"
          placeholder="Payment terms, cancellation policy, validity"
          rows={3}
          value={caseFields.termsAndConditions}
          onChange={(event) => updateCaseField("termsAndConditions", event.target.value)}
        />
      </label>

      <section className="full-width-field">
        <div className="section-heading">
          <div>
            <h2>Quote FX Settings</h2>
            <p>Add country-specific exchange-rate snapshots for this quotation.</p>
          </div>
          <button className="button-secondary" onClick={addExchangeRateRow} type="button">
            Add FX Row
          </button>
        </div>
        <div className="quote-item-table-shell">
          <table className="quote-item-table enhanced quote-fx-table">
            <thead>
              <tr>
                <th>Country</th>
                <th>Base Currency</th>
                <th>Quote Currency</th>
                <th>Rate</th>
                <th>Effective Date</th>
                <th>Source</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {exchangeRateRows.map((row) => {
                const rowCurrencyOptions = buildCurrencyOptions(countryOptions, row.baseCurrency);
                return (
                <tr key={row.id}>
                  <td>
                    <select
                      aria-label="Country"
                      value={row.countryCode}
                      onChange={(event) => applyCountryToExchangeRateRow(row.id, event.target.value)}
                    >
                      <option value="">Global / no country</option>
                      {countryOptions.map((country) => (
                        <option key={country.countryCode} value={country.countryCode}>
                          {country.countryCode} - {country.countryName}
                        </option>
                      ))}
                    </select>
                    {row.countryName ? <span className="subtext">{row.countryName}</span> : null}
                  </td>
                  <td>
                    <select
                      aria-label="Base currency"
                      value={row.baseCurrency}
                      onChange={(event) => updateExchangeRateRow(row.id, { baseCurrency: event.target.value.toUpperCase() })}
                    >
                      {rowCurrencyOptions.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label="Quote currency"
                      value={row.quoteCurrency}
                      onChange={(event) => updateExchangeRateRow(row.id, { quoteCurrency: event.target.value.toUpperCase() })}
                    >
                      <option value="KRW">KRW</option>
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label="Exchange rate"
                      min="0"
                      step="0.000001"
                      type="number"
                      value={row.rate}
                      onChange={(event) => updateExchangeRateRow(row.id, { rate: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="FX effective date"
                      type="date"
                      value={row.effectiveDate}
                      onChange={(event) => updateExchangeRateRow(row.id, { effectiveDate: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="FX source"
                      placeholder="manual"
                      value={row.source}
                      onChange={(event) => updateExchangeRateRow(row.id, { source: event.target.value })}
                    />
                  </td>
                  <td>
                    <div className="inline-actions compact-actions">
                      <button className="button-secondary" onClick={() => applyCommonExchangeRateToFxRow(row.id)} type="button">
                        Load Common FX
                      </button>
                      <button
                        className="button-secondary"
                        disabled={exchangeRateRows.length === 1}
                        onClick={() => removeExchangeRateRow(row.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="full-width-field">
        <div className="section-heading">
          <div>
            <h2>Quote Items</h2>
            <p>Search supplier items by keyword, then apply global or item-level FX and margin rules.</p>
          </div>
          <div className="inline-actions compact-actions">
            <button
              aria-describedby={sampleNotice ? "excel-sample-load-status" : undefined}
              className="button-secondary"
              onClick={loadExcelQuotationSample}
              type="button"
            >
              Load Excel Sample
            </button>
            <button className="button-secondary" onClick={() => addItemRow()} type="button">
              Add Row
            </button>
          </div>
        </div>
        {sampleNotice ? (
          <div
            aria-live="polite"
            className="quote-sample-load-status"
            id="excel-sample-load-status"
            role="status"
          >
            <strong>Excel sample loaded</strong>
            <span>{sampleNotice}</span>
          </div>
        ) : null}
        <div className="quote-global-controls">
          <label>
            Global FX to KRW
            <input
              min="0"
              step="0.000001"
              type="number"
              value={globalExchangeRate}
              onChange={(event) => setGlobalExchangeRate(event.target.value)}
            />
          </label>
          <button className="button-secondary" onClick={() => applyCommonExchangeRate(caseFields.currency)} type="button">
            Apply Common FX
          </button>
          <label>
            Global Margin Rate
            <input
              min="-1"
              step="0.01"
              type="number"
              value={globalMarginRate}
              onChange={(event) => setGlobalMarginRate(event.target.value)}
            />
          </label>
          <div>
            <strong>{formatMoney(itemRows.reduce((sum, row) => sum + calculateRowTotals(row, globalExchangeRate, globalMarginRate).sell, 0))}</strong>
            <span className="subtext">Estimated quote total</span>
          </div>
        </div>
        {exchangeRateNotice ? <p className="subtext">{exchangeRateNotice}</p> : null}
        <div className="quote-item-table-shell">
          <table className="quote-item-table enhanced">
            <colgroup>
              <col style={{ width: "92px" }} />
              <col style={{ width: "210px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "112px" }} />
              <col style={{ width: "72px" }} />
              <col style={{ width: "72px" }} />
              <col style={{ width: "112px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "104px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Day</th>
                <th>Keyword / Item</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Unit Cost</th>
                <th>Formula</th>
                <th>Qty</th>
                <th>Pax</th>
                <th>Margin</th>
                <th>Sell</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {itemDayGroups.map((group) => (
                <Fragment key={`${group.category}-${group.dayNo}`}>
                  {group.sectionStart ? (
                    <tr className="quote-category-row">
                      <td colSpan={11}>
                        <div className="quote-category-band">
                          <div>
                            <strong>{group.sectionLabel}</strong>
                            <span>{group.sectionDescription}</span>
                          </div>
                          <button
                            className="button-secondary"
                            onClick={() => addItemRow(itineraryRows[0]?.dayNo ?? "1", group.category)}
                            type="button"
                          >
                            Add {group.sectionLabel}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {group.rows.length > 0 ? (
                  group.rows.map((row, rowIndex) => {
                    const totals = calculateRowTotals(row, globalExchangeRate, globalMarginRate);
                    const preset = getCalculationPreset(row.calculationPreset);
                    const searchState = searches[row.id] ?? { isLoading: false, error: "", results: [] };
                    return (
                      <tr className={rowIndex === 0 ? "day-group-start" : undefined} key={row.id}>
                        {rowIndex === 0 ? (
                          <td className="day-group-cell" rowSpan={group.rows.length}>
                            <strong>Day {group.dayNo}</strong>
                            {group.serviceDate ? <span>{group.serviceDate}</span> : null}
                            {group.title ? <span>{group.title}</span> : null}
                            <button
                              className="button-secondary"
                              onClick={() => addItemRow(group.dayNo, group.category)}
                              type="button"
                            >
                              Add Item
                            </button>
                          </td>
                        ) : null}
                        <td>
                          <div className="item-lookup-cell">
                            <div className="lookup-row">
                              <input
                                aria-label="Search item keyword"
                                placeholder="hotel, bibimbap, bus..."
                                value={row.searchKeyword}
                                onChange={(event) => updateItemRow(row.id, { searchKeyword: event.target.value })}
                              />
                              <button className="button-secondary" onClick={() => searchCostItems(row)} type="button">
                                {searchState.isLoading ? "..." : "Search"}
                              </button>
                            </div>
                            <input
                              aria-label="Item name"
                              placeholder="Item name"
                              required
                              value={row.snapshotItemName}
                              onChange={(event) => updateItemRow(row.id, { snapshotItemName: event.target.value })}
                            />
                            {searchState.error ? <span className="danger-text">{searchState.error}</span> : null}
                            {searchState.results.length > 0 ? (
                              <div className="lookup-results">
                                {searchState.results.slice(0, 3).map((result) => (
                                  <button
                                    key={result.id}
                                    onClick={() => applyCostItem(row.id, result)}
                                    type="button"
                                  >
                                    <strong>{result.name_en ?? result.name_ko}</strong>
                                    <span>{result.domestic_suppliers.name_en ?? result.domestic_suppliers.name_ko}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          <select
                            aria-label="Item category"
                            value={row.itemCategory}
                            onChange={(event) => updateItemRow(row.id, { itemCategory: event.target.value })}
                          >
                            {ITEM_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            aria-label="Supplier name"
                            placeholder="Supplier"
                            value={row.snapshotSupplierName}
                            onChange={(event) => updateItemRow(row.id, { snapshotSupplierName: event.target.value })}
                          />
                        </td>
                        <td>
                          <div className="money-cell">
                            <select
                              aria-label="Currency"
                              value={row.snapshotCostCurrency}
                              onChange={(event) => updateItemRow(row.id, { snapshotCostCurrency: event.target.value.toUpperCase() })}
                            >
                              {buildCurrencyOptions(countryOptions, row.snapshotCostCurrency).map((currency) => (
                                <option key={currency} value={currency}>
                                  {currency}
                                </option>
                              ))}
                            </select>
                            <input
                              aria-label="Unit cost"
                              min="0"
                              placeholder="Cost"
                              step="0.01"
                              type="number"
                              value={row.snapshotUnitCostAmount}
                              onChange={(event) => updateItemRow(row.id, { snapshotUnitCostAmount: event.target.value })}
                            />
                        <input
                          aria-label="Exchange rate to KRW"
                          min="0"
                          placeholder={row.exchangeRateMode === "global" ? `Global ${globalExchangeRate}` : "FX"}
                          step="0.000001"
                          type="number"
                          disabled={row.exchangeRateMode === "global"}
                          value={row.exchangeRateToKrw}
                          onChange={(event) => updateItemRow(row.id, { exchangeRateToKrw: event.target.value })}
                        />
                        <select
                          aria-label="Exchange rate mode"
                          value={row.exchangeRateMode}
                          onChange={(event) =>
                            updateItemRow(row.id, { exchangeRateMode: event.target.value as QuoteItemRow["exchangeRateMode"] })
                          }
                        >
                          <option value="global">Global FX</option>
                          <option value="item">Item FX</option>
                        </select>
                      </div>
                        </td>
                        <td>
                          <select
                            aria-label="Calculation preset"
                            value={row.calculationPreset}
                            onChange={(event) =>
                              applyCalculationPreset(row.id, event.target.value as CalculationPreset)
                            }
                          >
                            {CALCULATION_PRESETS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <span className="subtext">{preset.formulaLabel}</span>
                        </td>
                        <td>
                          <input
                            aria-label={preset.quantityLabel}
                            min="1"
                            step="0.01"
                            type="number"
                            value={row.quantity}
                            onChange={(event) => updateItemRow(row.id, { quantity: event.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            aria-label="Pax count"
                            min="1"
                            step="1"
                            type="number"
                            value={row.paxCount}
                            onChange={(event) => updateItemRow(row.id, { paxCount: event.target.value })}
                          />
                        </td>
                        <td>
                          <div className="margin-cell">
                        <select
                          aria-label="Margin scope"
                          value={row.marginScope}
                          onChange={(event) =>
                            updateItemRow(row.id, { marginScope: event.target.value as QuoteItemRow["marginScope"] })
                          }
                        >
                          <option value="global">Global Margin</option>
                          <option value="item">Item Margin</option>
                        </select>
                        {row.marginScope === "global" ? (
                          <span className="subtext">Global {formatRate(globalMarginRate)}</span>
                        ) : (
                          <>
                            <select
                          aria-label="Margin mode"
                          value={row.marginMode}
                          onChange={(event) =>
                            updateItemRow(row.id, { marginMode: event.target.value as QuoteItemRow["marginMode"] })
                              }
                            >
                              <option value="auto_rate">Auto %</option>
                              <option value="manual_total">Manual Total</option>
                            </select>
                            {row.marginMode === "manual_total" ? (
                              <input
                                aria-label="Manual sell total"
                                min="0"
                                placeholder="Total"
                                step="0.01"
                                type="number"
                                value={row.manualTotal}
                                onChange={(event) => updateItemRow(row.id, { manualTotal: event.target.value })}
                              />
                            ) : (
                              <input
                                aria-label="Margin rate"
                                min="-1"
                                placeholder="Rate"
                                step="0.01"
                                type="number"
                                value={row.marginRate}
                            onChange={(event) => updateItemRow(row.id, { marginRate: event.target.value })}
                          />
                        )}
                          </>
                        )}
                      </div>
                        </td>
                        <td>
                          <strong>{formatMoney(totals.sell)}</strong>
                          <span className="subtext">Cost {formatMoney(totals.cost)}</span>
                        </td>
                        <td>
                          <button
                            className="button-secondary"
                            disabled={itemRows.length === 1}
                            onClick={() => removeItemRow(row.id)}
                            type="button"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                  ) : (
                  <tr className="day-group-start" key={`empty-${group.dayNo}`}>
                    <td className="day-group-cell">
                      <strong>Day {group.dayNo}</strong>
                      {group.serviceDate ? <span>{group.serviceDate}</span> : null}
                      {group.title ? <span>{group.title}</span> : null}
                      <button
                        className="button-secondary"
                        onClick={() => addItemRow(group.dayNo, group.category)}
                        type="button"
                      >
                        Add Item
                      </button>
                    </td>
                    <td className="empty-day-items" colSpan={10}>
                      No quote items assigned to this day yet.
                    </td>
                  </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9}>Estimated total</td>
                <td>
                  {formatMoney(
                    itemRows.reduce((sum, row) => sum + calculateRowTotals(row, globalExchangeRate, globalMarginRate).sell, 0)
                  )}
                </td>
                <td>Editable</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="full-width-field">
        <div className="section-heading">
          <div>
            <h2>Itinerary Days</h2>
            <p>Use the same day-by-day layout as the Excel quotation itinerary sheet.</p>
          </div>
          <button className="button-secondary" onClick={addItineraryRow} type="button">
            Add Day
          </button>
        </div>
        <div className="itinerary-table-shell">
          <table className="itinerary-table">
            <colgroup>
              <col style={{ width: "76px" }} />
              <col style={{ width: "132px" }} />
              <col style={{ width: "96px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "180px" }} />
              <col style={{ width: "280px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "170px" }} />
              <col style={{ width: "96px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Day</th>
                <th>Date</th>
                <th>Weekday</th>
                <th>City / Area</th>
                <th>Title</th>
                <th>Program Description</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
                <th>Hotel</th>
                <th>Remarks</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {itineraryRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      aria-label="Itinerary day number"
                      min="1"
                      type="number"
                      value={row.dayNo}
                      onChange={(event) => updateItineraryRow(row.id, { dayNo: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Itinerary service date"
                      type="date"
                      value={row.serviceDate}
                      onChange={(event) => updateItineraryRow(row.id, { serviceDate: event.target.value })}
                    />
                  </td>
                  <td>
                    <span className="weekday-cell">{formatWeekday(row.serviceDate)}</span>
                  </td>
                  <td>
                    <input
                      aria-label="City or area"
                      placeholder="Seoul"
                      value={row.cityArea}
                      onChange={(event) => updateItineraryRow(row.id, { cityArea: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Itinerary title"
                      placeholder="Arrival and transfer"
                      value={row.title}
                      onChange={(event) => updateItineraryRow(row.id, { title: event.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      aria-label="Program description"
                      rows={3}
                      value={row.publicDescription}
                      onChange={(event) => updateItineraryRow(row.id, { publicDescription: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Breakfast"
                      placeholder="Hotel"
                      value={row.breakfast}
                      onChange={(event) => updateItineraryRow(row.id, { breakfast: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Lunch"
                      placeholder="Local meal"
                      value={row.lunch}
                      onChange={(event) => updateItineraryRow(row.id, { lunch: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Dinner"
                      placeholder="Dinner"
                      value={row.dinner}
                      onChange={(event) => updateItineraryRow(row.id, { dinner: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Hotel"
                      placeholder="Hotel name"
                      value={row.hotelName}
                      onChange={(event) => updateItineraryRow(row.id, { hotelName: event.target.value })}
                    />
                  </td>
                  <td>
                    <textarea
                      aria-label="Remarks"
                      rows={3}
                      value={row.remarks}
                      onChange={(event) => updateItineraryRow(row.id, { remarks: event.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      className="button-secondary"
                      disabled={itineraryRows.length === 1}
                      onClick={() => removeItineraryRow(row.id)}
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
      </section>

      <div className="inline-actions">
        <button className="button-primary" disabled={isBusy} type="submit">
          Create Quote Case
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );

  async function searchCostItems(row: QuoteItemRow) {
    // Domestic Supplier 원가표에서 키워드로 상품/가격을 찾습니다.
    // 사용자는 기존 엑셀에서 하던 것처럼 호텔명, 메뉴명, 관광지명 등을 검색어로 넣을 수 있습니다.
    const query = row.searchKeyword.trim() || row.snapshotItemName.trim();
    if (!query) {
      setSearches((current) => ({
        ...current,
        [row.id]: { isLoading: false, error: "Enter a keyword first.", results: [] }
      }));
      return;
    }

    setSearches((current) => ({ ...current, [row.id]: { isLoading: true, error: "", results: [] } }));
    const response = await safeFetch(`/api/cost-items/search?q=${encodeURIComponent(query)}&limit=5`);
    const payload = await response.json();
    if (!response.ok) {
      setSearches((current) => ({
        ...current,
        [row.id]: { isLoading: false, error: payload.error ?? "Search failed.", results: [] }
      }));
      return;
    }

    setSearches((current) => ({
      ...current,
      [row.id]: { isLoading: false, error: "", results: Array.isArray(payload.data) ? payload.data : [] }
    }));
  }

  function applyCostItem(rowId: string, result: CostSearchResult) {
    // 검색 결과를 견적 항목에 적용할 때는 supplier product를 그대로 참조만 하지 않고
    // 상품명/공급사명/통화/단가를 snapshot으로 복사합니다.
    // 이후 공급사 원가표가 수정되어도 이미 만든 견적서 금액이 바뀌지 않도록 하기 위함입니다.
    const price = choosePrice(result.supplier_prices);
    const category = mapProductCategory(result.product_type, result.domestic_suppliers.category);
    setItemRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              sourceSupplierProductId: result.id,
              sourceSupplierPriceId: price?.id ?? null,
              itemCategory: category,
              snapshotItemName: result.name_en ?? result.name_ko,
              snapshotSupplierName: result.domestic_suppliers.name_en ?? result.domestic_suppliers.name_ko,
              snapshotCostCurrency: price?.currency ?? row.snapshotCostCurrency,
              snapshotUnitCostAmount:
                price?.cost_amount === undefined || price?.cost_amount === null
                  ? row.snapshotUnitCostAmount
                  : String(price.cost_amount),
              pricingUnit: price?.pricing_unit ?? row.pricingUnit,
              calculationPreset: presetFromPricingUnit(price?.pricing_unit ?? row.pricingUnit),
              searchKeyword: result.search_name
            }
          : row
      )
    );
    if (price?.currency) {
      void applyCommonExchangeRateToItem(rowId, price.currency);
    }
    setSearches((current) => ({ ...current, [rowId]: { isLoading: false, error: "", results: [] } }));
  }

  function updateCaseField(field: keyof QuoteCaseFields, value: string) {
    setCaseFields((current) => ({ ...current, [field]: value }));
  }

  async function applyCommonExchangeRate(currency: string, countryCode = "") {
    // 전체 견적 항목에 적용할 공통 환율을 가져옵니다.
    // 국가별 환율이 다를 수 있으므로 countryCode가 있으면 함께 조회합니다.
    const rate = await fetchCommonExchangeRate(currency, countryCode);
    if (!rate) return;
    setGlobalExchangeRate(String(rate.rate));
    setExchangeRateNotice(
      `${rate.baseCurrency}/${rate.quoteCurrency} ${rate.rate.toLocaleString()} applied from common FX (${rate.effectiveDate}).`
    );
  }

  async function applyCommonExchangeRateToItem(rowId: string, currency: string) {
    // 일부 항목만 다른 환율을 써야 할 때 item 단위 환율로 전환합니다.
    // 예: 호텔은 USD 기준, 식사는 MYR 기준 등 통화가 섞인 견적에 사용합니다.
    const matchedFxRow = exchangeRateRows.find((row) => row.baseCurrency.trim().toUpperCase() === currency.trim().toUpperCase());
    const rate = await fetchCommonExchangeRate(currency, matchedFxRow?.countryCode ?? "");
    if (!rate) return;
    setItemRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              exchangeRateMode: "item",
              exchangeRateToKrw: String(rate.rate)
            }
          : row
      )
    );
    setExchangeRateNotice(
      `${rate.baseCurrency}/${rate.quoteCurrency} ${rate.rate.toLocaleString()} applied to selected item from common FX.`
    );
  }

  async function applyCommonExchangeRateToFxRow(rowId: string) {
    const row = exchangeRateRows.find((item) => item.id === rowId);
    if (!row) return;
    const rate = await fetchCommonExchangeRate(row.baseCurrency, row.countryCode);
    if (!rate) return;
    updateExchangeRateRow(rowId, {
      countryCode: rate.countryCode ?? row.countryCode,
      countryName: rate.countryName ?? row.countryName,
      baseCurrency: rate.baseCurrency,
      quoteCurrency: rate.quoteCurrency,
      rate: String(rate.rate),
      effectiveDate: rate.effectiveDate,
      sourceExchangeRateId: rate.id === "identity" ? null : rate.id,
      source: rate.source ?? "common"
    });
  }

  async function fetchCommonExchangeRate(currency: string, countryCode = ""): Promise<ExchangeRateLookup | null> {
    const normalized = currency.trim().toUpperCase() || "KRW";
    const normalizedCountry = countryCode.trim().toUpperCase();
    try {
      const params = new URLSearchParams({ latest: "true", baseCurrency: normalized });
      if (normalizedCountry) params.set("countryCode", normalizedCountry);
      const response = await safeFetch(`/api/exchange-rates?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.data) {
        setExchangeRateNotice(`No active common FX rate found for ${normalized}. Add it in Exchange Rates or enter manually.`);
        return null;
      }
      return payload.data;
    } catch {
      setExchangeRateNotice("Common FX lookup failed. Enter the exchange rate manually.");
      return null;
    }
  }

  function loadExcelQuotationSample() {
    const loadId = Date.now();
    setMessage("");
    setExchangeRateNotice("");
    setCaseFields({ ...EXCEL_SAMPLE_CASE_FIELDS });
    setGlobalExchangeRate(EXCEL_SAMPLE_USD_TO_KRW);
    setGlobalMarginRate("0.15");
    // 매번 새로운 key를 사용해 브라우저 자동완성이나 이전 행의 로컬 상태가 샘플을 가리지 않게 합니다.
    setItemRows(EXCEL_SAMPLE_ITEMS.map((row) => ({ ...row, id: `${row.id}-${loadId}` })));
    setItineraryRows(EXCEL_SAMPLE_ITINERARY.map((row) => ({ ...row, id: `${row.id}-${loadId}` })));
    setExchangeRateRows([
      {
        ...DEFAULT_EXCHANGE_RATE_ROW,
        id: `fx-sample-th-${loadId}`,
        countryCode: "TH",
        countryName: "Thailand",
        baseCurrency: "USD",
        quoteCurrency: "KRW",
        rate: EXCEL_SAMPLE_USD_TO_KRW,
        effectiveDate: "2026-10-12",
        source: "excel_sample",
        notes: "Thailand private tour quotation FX snapshot"
      }
    ]);
    setSearches({});
    setSampleNotice(
      `${EXCEL_SAMPLE_ITEMS.length} quote items and ${EXCEL_SAMPLE_ITINERARY.length} itinerary days are ready. ` +
        `USD 1 = KRW ${Number(EXCEL_SAMPLE_USD_TO_KRW).toLocaleString("en-US")} is applied; review the data before saving.`
    );
  }

  function addExchangeRateRow() {
    setExchangeRateRows((current) => [
      ...current,
      {
        ...DEFAULT_EXCHANGE_RATE_ROW,
        id: `fx-${Date.now()}-${current.length}`,
        countryCode: "",
        countryName: "",
        sourceExchangeRateId: null,
        notes: ""
      }
    ]);
  }

  function removeExchangeRateRow(id: string) {
    setExchangeRateRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateExchangeRateRow(id: string, patch: Partial<QuoteExchangeRateRow>) {
    setExchangeRateRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyCountryToExchangeRateRow(id: string, countryCode: string) {
    // 국가를 선택하면 country master에 저장된 기본 통화를 함께 채웁니다.
    // 사용자가 입력한 country name은 보존하되, 내부 관계는 countryCode 기준으로 맞춥니다.
    const selectedCountry = countryOptions.find((country) => country.countryCode === countryCode);
    updateExchangeRateRow(id, {
      countryCode: selectedCountry?.countryCode ?? "",
      countryName: selectedCountry?.countryName ?? "",
      baseCurrency: selectedCountry?.defaultCurrency ?? exchangeRateRows.find((row) => row.id === id)?.baseCurrency ?? "USD",
      sourceExchangeRateId: null
    });
  }

  function addItemRow(dayNo?: string, category = "other") {
    setItemRows((current) => [
      ...current,
      {
        ...DEFAULT_ITEM_ROW,
        id: `row-${Date.now()}-${current.length}`,
        sourceSupplierProductId: null,
        sourceSupplierPriceId: null,
        itineraryDayNo: dayNo ?? itineraryRows[0]?.dayNo ?? current[0]?.itineraryDayNo ?? "1",
        itemCategory: category,
        searchKeyword: "",
        snapshotItemName: "",
        snapshotSupplierName: "",
        partnerVisibleNotes: ""
      }
    ]);
  }

  function removeItemRow(id: string) {
    setItemRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateItemRow(id: string, patch: Partial<QuoteItemRow>) {
    setItemRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function applyCalculationPreset(id: string, value: CalculationPreset) {
    const preset = getCalculationPreset(value);
    updateItemRow(id, {
      calculationPreset: value,
      pricingUnit: preset.pricingUnit,
      marginMode: value === "manual_total" ? "manual_total" : "auto_rate"
    });
  }

  function addItineraryRow() {
    setItineraryRows((current) => [
      ...current,
      {
        ...DEFAULT_ITINERARY_ROW,
        id: `day-${Date.now()}-${current.length}`,
        dayNo: String(current.length + 1),
        serviceDate: "",
        cityArea: "",
        title: "",
        hotelName: "",
        remarks: "",
        publicDescription: "",
        internalNotes: ""
      }
    ]);
  }

  function removeItineraryRow(id: string) {
    setItineraryRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function updateItineraryRow(id: string, patch: Partial<ItineraryRow>) {
    // Day 번호가 바뀌면 연결된 quote item의 itineraryDayNo도 같이 바꿉니다.
    // 일정표와 원가표가 서로 다른 Day를 바라보면 견적서/확정서/인보이스 동기화가 깨집니다.
    const previousDayNo = itineraryRows.find((row) => row.id === id)?.dayNo;
    setItineraryRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    if (patch.dayNo && previousDayNo && patch.dayNo !== previousDayNo) {
      setItemRows((current) =>
        current.map((row) => (row.itineraryDayNo === previousDayNo ? { ...row, itineraryDayNo: patch.dayNo ?? previousDayNo } : row))
      );
    }
  }
}

function buildItemDayGroups(itemRows: QuoteItemRow[], itineraryRows: ItineraryRow[]) {
  // 화면에서는 엑셀처럼 "카테고리 -> Day -> 항목" 순서로 묶어 보여줍니다.
  // 같은 Day에 호텔/차량/식사/관광지 항목이 여러 개 들어갈 수 있으므로
  // 단순 flat list보다 이 그룹 구조가 업무자가 확인하기 쉽습니다.
  const assigned = new Set<string>();
  const groups = QUOTE_ITEM_SECTIONS.flatMap((section) =>
    itineraryRows.map((day, dayIndex) => {
      const rows = itemRows.filter((row) => row.itemCategory === section.category && row.itineraryDayNo === day.dayNo);
      rows.forEach((row) => assigned.add(row.id));
      return {
        category: section.category,
        sectionLabel: section.label,
        sectionDescription: section.description,
        sectionStart: dayIndex === 0,
        dayNo: day.dayNo,
        serviceDate: day.serviceDate,
        title: day.title,
        rows
      };
    })
  );

  const orphanRows = itemRows.filter((row) => !assigned.has(row.id));
  if (orphanRows.length > 0) {
    groups.push({
      category: "other",
      sectionLabel: "Unassigned",
      sectionDescription: "Items whose category or day does not match the current itinerary setup.",
      sectionStart: true,
      dayNo: "Unassigned",
      serviceDate: "",
      title: "Items not linked to an itinerary day",
      rows: orphanRows
    });
  }

  return groups;
}

function choosePrice(prices: CostSearchPrice[]) {
  return prices.find((price) => price.status === "active") ?? prices[0] ?? null;
}

function mapProductCategory(productType: string, supplierCategory: string) {
  const normalized = `${productType} ${supplierCategory}`.toLowerCase();
  if (normalized.includes("hotel")) return "hotel";
  if (normalized.includes("meal") || normalized.includes("restaurant")) return "meal";
  if (normalized.includes("transport") || normalized.includes("coach") || normalized.includes("vehicle")) {
    return "transport";
  }
  if (normalized.includes("guide")) return "guide";
  if (normalized.includes("attraction") || normalized.includes("ticket")) return "attraction";
  return "other";
}

function presetFromPricingUnit(pricingUnit: string): CalculationPreset {
  if (pricingUnit === "per_person") return "person_quantity";
  if (pricingUnit === "per_room") return "room_night";
  if (pricingUnit === "per_vehicle") return "vehicle_day";
  if (pricingUnit === "per_guide" || pricingUnit === "per_day") return "guide_day";
  return "group_quantity";
}

function getCalculationPreset(value: CalculationPreset) {
  return CALCULATION_PRESETS.find((preset) => preset.value === value) ?? CALCULATION_PRESETS[0];
}

function normalizeOptionalString(value: FormDataEntryValue | string | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalNumber(value: FormDataEntryValue | string | null) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getEffectiveExchangeRate(row: QuoteItemRow, globalExchangeRate: string) {
  return row.exchangeRateMode === "global"
    ? normalizeOptionalNumber(globalExchangeRate) ?? 1
    : normalizeOptionalNumber(row.exchangeRateToKrw) ?? 1;
}

function getEffectiveMargin(row: QuoteItemRow, globalMarginRate: string) {
  if (row.marginScope === "global") {
    return { mode: "auto_rate", rate: normalizeOptionalNumber(globalMarginRate) ?? 0 };
  }

  if (row.marginMode === "manual_total") {
    return { mode: "manual_total", rate: null };
  }

  return { mode: "auto_rate", rate: normalizeOptionalNumber(row.marginRate) ?? 0 };
}

function calculateRowTotals(row: QuoteItemRow, globalExchangeRate: string, globalMarginRate: string) {
  // 화면용 즉시 계산 함수입니다.
  // 서버 저장 전에도 사용자가 엑셀처럼 단가, 수량, pax, 환율, 마진을 바꾸면
  // 원가와 판매가가 바로 확인되어야 합니다.
  const unitCost = normalizeOptionalNumber(row.snapshotUnitCostAmount) ?? 0;
  const exchangeRate = getEffectiveExchangeRate(row, globalExchangeRate);
  const quantity = normalizeOptionalNumber(row.quantity) ?? 1;
  const paxCount = normalizeOptionalNumber(row.paxCount) ?? 1;
  const multiplier = row.pricingUnit === "per_person" ? quantity * paxCount : quantity;
  const cost = roundMoney(unitCost * multiplier * exchangeRate);
  const margin = getEffectiveMargin(row, globalMarginRate);
  const sell =
    margin.mode === "manual_total"
      ? roundMoney(normalizeOptionalNumber(row.manualTotal) ?? 0)
      : roundMoney(cost * (1 + (margin.rate ?? 0)));

  return { cost, sell };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatRate(value: string) {
  const parsed = normalizeOptionalNumber(value) ?? 0;
  return `${Math.round(parsed * 10000) / 100}%`;
}

function formatWeekday(value: string) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { weekday: "short" });
}
