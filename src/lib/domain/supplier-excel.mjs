import { inflateRawSync } from "node:zlib";
import { createXlsxBuffer } from "./xlsx.mjs";

/**
 * Domestic Supplier 원가표 엑셀 입출력 모듈입니다.
 *
 * Notion/기존 엑셀에서 내려받은 호텔, 차량, 식당, 관광지, 가이드, 기타 비용을
 * 한 번에 업로드/다운로드할 수 있도록 같은 컬럼 구조를 사용합니다.
 * 이미지 컬럼은 item당 최대 10장까지 지원하며, 추후 Supabase Storage 경로와
 * 외부 URL을 모두 받을 수 있게 분리해 두었습니다.
 */
export const SUPPLIER_EXCEL_SHEET_NAME = "Supplier Cost Master";

export const SUPPLIER_EXCEL_COLUMNS = [
  ["supplierCategory", "hotel | vehicle | restaurant | attraction | guide | other"],
  ["supplierNameKo", "Domestic supplier name, required"],
  ["supplierNameEn", "Optional English supplier name"],
  ["regionLevel1", "Seoul, Busan, Jeju"],
  ["regionLevel2", "Gangnam, Haeundae"],
  ["address", "Supplier address"],
  ["phone", "Supplier phone"],
  ["website", "Supplier website"],
  ["supplierKeywords", "Comma-separated supplier aliases"],
  ["supplierNotes", "Internal supplier notes"],
  ["productType", "room | vehicle | meal | ticket | guide_service | meeting_room | other"],
  ["itemNameKo", "Cost item name, required"],
  ["itemNameEn", "Optional English item name"],
  ["searchName", "Keyword aliases for item search"],
  ["description", "Description, operation hours, terms"],
  ["capacity", "Numeric capacity"],
  ["roomType", "Hotel room type"],
  ["breakfastIncluded", "true | false"],
  ["vehicleSeatCount", "Numeric seat count"],
  ["menuTags", "Comma-separated tags"],
  ["pricingUnit", "per_person | per_group | per_room | per_vehicle | per_guide | per_day"],
  ["currency", "KRW"],
  ["costAmount", "Numeric cost amount, required for price row"],
  ["minPax", "Minimum pax"],
  ["maxPax", "Maximum pax"],
  ["seasonLabel", "Adult, Child, weekday, peak season"],
  ["validFrom", "yyyy-mm-dd"],
  ["validTo", "yyyy-mm-dd"],
  ["weekdayRule", "weekday | weekend | holiday | all"],
  ["includesTax", "true | false"],
  ["priceNotes", "Internal price notes"],
  ...Array.from({ length: 10 }, (_, index) => [`image${index + 1}StoragePath`, "Supabase Storage path"]),
  ...Array.from({ length: 10 }, (_, index) => [`image${index + 1}Url`, "https:// image URL"]),
  ...Array.from({ length: 10 }, (_, index) => [`image${index + 1}Label`, "Image label"]),
  ...Array.from({ length: 10 }, (_, index) => [`image${index + 1}AltText`, "Image alt text"])
];

const HEADER = SUPPLIER_EXCEL_COLUMNS.map(([key]) => key);

export function buildSupplierTemplateWorkbook() {
  // 사용자가 빈 양식을 내려받아 그대로 채울 수 있는 템플릿입니다.
  // 헤더 아래 설명 row와 샘플 row를 넣어 Notion CSV/엑셀 이관 시 매핑 오류를 줄입니다.
  return createXlsxBuffer(
    [
      ["JHT Domestic Supplier Cost Master Template"],
      ["Fill one row per supplier item price. Repeat supplier/item fields for multiple price rows. Image columns support up to 10 images per item."],
      [],
      HEADER,
      SUPPLIER_EXCEL_COLUMNS.map(([, description]) => description),
      HEADER.map((key) => sampleHotelRow()[key] ?? ""),
      HEADER.map((key) => sampleRestaurantRow()[key] ?? ""),
      HEADER.map((key) => sampleAttractionRow()[key] ?? "")
    ],
    { sheetName: SUPPLIER_EXCEL_SHEET_NAME }
  );
}

export function buildSupplierExportWorkbook(rows) {
  return createXlsxBuffer(
    [
      ["JHT Domestic Supplier Cost Master Export"],
      [`Exported at ${new Date().toISOString()}`],
      [],
      HEADER,
      ...rows.map((row) => HEADER.map((key) => row[key] ?? ""))
    ],
    { sheetName: SUPPLIER_EXCEL_SHEET_NAME }
  );
}

export function parseSupplierWorkbook(buffer) {
  // 별도 대형 엑셀 라이브러리 없이도 업로드 파일을 읽기 위해
  // xlsx zip 내부의 첫 번째 worksheet와 sharedStrings를 직접 파싱합니다.
  const files = unzipXlsx(buffer);
  const sharedStrings = parseSharedStrings(files.get("xl/sharedStrings.xml") ?? "");
  const workbookXml = files.get("xl/workbook.xml") ?? "";
  const relsXml = files.get("xl/_rels/workbook.xml.rels") ?? "";
  const sheetPath = resolveFirstSheetPath(workbookXml, relsXml);
  const sheetXml = files.get(sheetPath);
  if (!sheetXml) throw new Error("Workbook does not contain a readable first worksheet");

  const rows = parseSheetRows(sheetXml, sharedStrings);
  const headerIndex = rows.findIndex((row) => row.includes("supplierCategory") && row.includes("itemNameKo"));
  if (headerIndex === -1) throw new Error("Supplier template header row was not found");

  const headers = rows[headerIndex].map((value) => String(value ?? "").trim());
  return rows
    .slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, normalizeCell(row[index])])))
    .filter((row) => row.supplierNameKo || row.itemNameKo)
    .filter((row) => !String(row.supplierCategory ?? "").includes("|"));
}

export function supplierRowsFromDatabase(suppliers) {
  // DB의 supplier -> product -> price -> media 구조를 엑셀의 한 줄 단위로 펼칩니다.
  // 가격이 여러 개면 같은 supplier/product 정보가 반복되어도, 엑셀에서 필터/수정하기 쉽습니다.
  const rows = [];
  for (const supplier of suppliers ?? []) {
    if (!supplier.supplier_products?.length) {
      rows.push({
        supplierCategory: supplier.category,
        supplierNameKo: supplier.name_ko,
        supplierNameEn: supplier.name_en,
        regionLevel1: supplier.region_level1,
        regionLevel2: supplier.region_level2,
        address: supplier.address,
        phone: supplier.phone,
        website: supplier.website,
        supplierKeywords: supplier.search_keywords,
        supplierNotes: supplier.internal_notes
      });
      continue;
    }

    for (const product of supplier.supplier_products ?? []) {
      const prices = product.supplier_prices?.length ? product.supplier_prices : [null];
      for (const price of prices) {
        const row = {
          supplierCategory: supplier.category,
          supplierNameKo: supplier.name_ko,
          supplierNameEn: supplier.name_en,
          regionLevel1: supplier.region_level1,
          regionLevel2: supplier.region_level2,
          address: supplier.address,
          phone: supplier.phone,
          website: supplier.website,
          supplierKeywords: supplier.search_keywords,
          supplierNotes: supplier.internal_notes,
          productType: product.product_type,
          itemNameKo: product.name_ko,
          itemNameEn: product.name_en,
          searchName: product.search_name,
          description: product.description,
          capacity: product.capacity,
          roomType: product.room_type,
          breakfastIncluded: product.breakfast_included,
          vehicleSeatCount: product.vehicle_seat_count,
          menuTags: Array.isArray(product.menu_tags) ? product.menu_tags.join(", ") : "",
          pricingUnit: price?.pricing_unit,
          currency: price?.currency,
          costAmount: price?.cost_amount,
          minPax: price?.min_pax,
          maxPax: price?.max_pax,
          seasonLabel: price?.season_label,
          validFrom: price?.valid_from,
          validTo: price?.valid_to,
          weekdayRule: price?.weekday_rule,
          includesTax: price?.includes_tax,
          priceNotes: price?.notes
        };

        const media = (product.supplier_media ?? []).slice(0, 10);
        media.forEach((image, index) => {
          const no = index + 1;
          row[`image${no}StoragePath`] = image.storage_path;
          row[`image${no}Url`] = image.image_url;
          row[`image${no}Label`] = image.public_label;
          row[`image${no}AltText`] = image.alt_text;
        });
        rows.push(row);
      }
    }
  }
  return rows;
}

export function mediaItemsFromSupplierExcelRow(row) {
  // image1~image10 컬럼을 supplier_media insert용 배열로 변환합니다.
  // 빈 컬럼은 무시해서 사용자가 필요한 이미지 수만 입력할 수 있습니다.
  const items = [];
  for (let index = 1; index <= 10; index += 1) {
    const storagePath = clean(row[`image${index}StoragePath`]);
    const imageUrl = clean(row[`image${index}Url`]);
    if (!storagePath && !imageUrl) continue;
    items.push({
      storagePath,
      imageUrl,
      publicLabel: clean(row[`image${index}Label`]),
      altText: clean(row[`image${index}AltText`]),
      sortOrder: index
    });
  }
  return items;
}

export function clean(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function sampleHotelRow() {
  return {
    supplierCategory: "hotel",
    supplierNameKo: "Sample Hotel",
    regionLevel1: "Seoul",
    productType: "room",
    itemNameKo: "Deluxe Twin",
    searchName: "sample hotel deluxe twin",
    pricingUnit: "per_room",
    currency: "KRW",
    costAmount: 180000,
    includesTax: "true",
    image1Url: "https://example.com/hotel-room.jpg",
    image1Label: "Room"
  };
}

function sampleRestaurantRow() {
  return {
    supplierCategory: "restaurant",
    supplierNameKo: "Sample Restaurant",
    regionLevel1: "Seoul",
    productType: "meal",
    itemNameKo: "Bibimbap Set",
    menuTags: "Halal, Vegetarian",
    pricingUnit: "per_person",
    currency: "KRW",
    costAmount: 22000,
    includesTax: "true"
  };
}

function sampleAttractionRow() {
  return {
    supplierCategory: "attraction",
    supplierNameKo: "Sample Attraction",
    regionLevel1: "Seoul",
    productType: "ticket",
    itemNameKo: "Observatory Adult",
    seasonLabel: "Adult",
    pricingUnit: "per_person",
    currency: "KRW",
    costAmount: 15000,
    includesTax: "true"
  };
}

function normalizeCell(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value.trim() : value;
}

function unzipXlsx(buffer) {
  const bytes = Buffer.from(buffer);
  const files = new Map();
  let offset = 0;
  while (offset + 30 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const method = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const fileNameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const fileName = bytes.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const compressed = bytes.subarray(dataStart, dataEnd);
    const content = method === 8 ? inflateRawSync(compressed) : compressed;
    files.set(fileName, content.toString("utf8"));
    offset = dataEnd;
  }
  return files;
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => textMatch[1]).join(""))
  );
}

function resolveFirstSheetPath(workbookXml, relsXml) {
  const rid = workbookXml.match(/<sheet[^>]+r:id="([^"]+)"/)?.[1] ?? "rId1";
  const targetPattern = new RegExp(`<Relationship[^>]+Id="${escapeRegex(rid)}"[^>]+Target="([^"]+)"`);
  const target = relsXml.match(targetPattern)?.[1] ?? "worksheets/sheet1.xml";
  return `xl/${target.replace(/^\/?xl\//, "")}`;
}

function parseSheetRows(xml, sharedStrings) {
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
      const index = ref ? columnIndex(ref) - 1 : row.length;
      row[index] = parseCellValue(attrs, body, sharedStrings);
    }
    return row;
  });
}

function parseCellValue(attrs, body, sharedStrings) {
  if (attrs.includes('t="s"')) {
    const idx = Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? 0);
    return sharedStrings[idx] ?? "";
  }
  if (attrs.includes('t="inlineStr"')) {
    return decodeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
  }
  const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  return decodeXml(value);
}

function columnIndex(name) {
  return name.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function decodeXml(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
