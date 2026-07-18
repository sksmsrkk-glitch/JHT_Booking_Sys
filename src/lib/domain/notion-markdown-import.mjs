/**
 * @file 한글 책임: `notion markdown import` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
const MEDIA_EXTENSIONS = new Map([
  [".jpg", "image"],
  [".jpeg", "image"],
  [".png", "image"],
  [".webp", "image"],
  [".gif", "image"],
  [".mp4", "video"],
  [".mov", "video"],
  [".webm", "video"]
]);

const DEFAULT_COMPANY_ID = "__REPLACE_WITH_COMPANY_UUID__";
const DEFAULT_DOMESTIC_SUPPLIER_ID = "__REPLACE_WITH_DOMESTIC_SUPPLIER_UUID__";
const DEFAULT_SUPPLIER_PRODUCT_ID = "__REPLACE_WITH_SUPPLIER_PRODUCT_UUID__";

export function parseNotionMarkdownDocument({ content, sourcePath = "", baseDir = "" }) {
  // Notion 속성 표와 본문·첨부 링크를 분리해 이후 공급사 데이터 변환 단계가 원문 형식에 덜 의존하게 합니다.
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("Notion markdown content is required");
  }

  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const title = extractTitle(lines, sourcePath);
  const properties = parseProperties(lines);
  const media = parseMediaReferences(content, { baseDir, pageId: properties["페이지 ID"], title });
  const bodyText = parseBodyText(lines);

  return {
    title,
    sourcePath,
    pageId: properties["페이지 ID"] ?? parsePageIdFromPath(sourcePath),
    properties,
    bodyText,
    media
  };
}

export function buildSupplierCostMasterFromNotionDocument(document, options = {}) {
  // 한 Notion 문서에서 공급사 1건, 상품 여러 건, 가격 여러 건의 관계형 입력을 구성합니다.
  const properties = document.properties;
  const pageId = document.pageId || stableSlug(document.title);
  const supplierLookupKey = `notion:${pageId}`;
  const category = inferSupplierCategory(properties);
  const productEntries = parseProductEntries(properties, document.title);
  const products = productEntries.length > 0 ? productEntries : [buildFallbackProductEntry(document.title, category)];
  const baseDescription = buildDescription(document);
  const supplierRow = {
    company_id: options.companyId ?? DEFAULT_COMPANY_ID,
    category,
    name_ko: document.title,
    name_en: pickFirst(properties, ["상호명 (EN)", "상호명 EN", "Name (EN)"]),
    search_keywords: compactJoin(
      [
        pickFirst(properties, ["검색 대표 키워드", "키워드"]),
        pickFirst(properties, ["컨텐츠 유형", "콘텐츠 유형"]),
        pickFirst(properties, ["파트너사 구분"]),
        document.title
      ],
      ", "
    ),
    region_level1: pickFirst(properties, ["지역_광역", "지역 명칭 (표기용)", "지역"]),
    region_level2: pickFirst(properties, ["지역 명칭 (문서 표기용)", "지역_상세"]),
    address: pickFirst(properties, ["주소"]),
    status: inferRecordStatus(properties),
    internal_notes: buildSupplierInternalNotes(document)
  };

  const productRows = products.map((entry, index) => {
    const productLookupKey = `${supplierLookupKey}:product:${index + 1}`;
    const row = {
      domestic_supplier_id: options.domesticSupplierId ?? DEFAULT_DOMESTIC_SUPPLIER_ID,
      product_type: entry.productType,
      name_ko: entry.nameKo,
      name_en: entry.nameEn,
      search_name: compactJoin([entry.nameKo, entry.nameEn, supplierRow.search_keywords], " "),
      description: baseDescription,
      menu_tags: entry.menuTags.length > 0 ? entry.menuTags : null,
      status: "active"
    };
    const priceRows = buildPriceRows({ document, productLookupKey, supplierProductId: options.supplierProductId });
    return { productLookupKey, row: stripNullValues(row), priceRows };
  });

  const mediaRows = document.media.slice(0, 10).map((item, index) => ({
    supplierLookupKey,
    supplierProductLookupKey: productRows[0]?.productLookupKey ?? null,
    row: stripNullValues({
      domestic_supplier_id: options.domesticSupplierId ?? DEFAULT_DOMESTIC_SUPPLIER_ID,
      supplier_product_id: options.supplierProductId ?? null,
      media_type: item.mediaType,
      storage_path: item.storagePath,
      image_url: null,
      public_label: item.label || `${document.title} media ${index + 1}`,
      alt_text: item.label || document.title,
      sort_order: index + 1
    }),
    sourceFile: item.sourceFile,
    sourceHref: item.href
  }));

  return {
    supplierLookupKey,
    sourcePath: document.sourcePath,
    pageId,
    supplierRow: stripNullValues(supplierRow),
    productRows,
    mediaRows,
    warnings: buildWarnings({ supplierRow, productRows })
  };
}

export function buildNotionMarkdownImportPlan(records, options = {}) {
  // 전체 변환 결과와 경고를 먼저 제공해 사용자가 실제 DB 반영 전에 누락 필드를 검토할 수 있게 합니다.
  const sourceName = options.sourceName ?? "notion-markdown-export";
  const summary = summarizeRecords(records);

  return {
    formatVersion: 1,
    sourceKind: "notion_markdown_export",
    sourceName,
    generatedAt: new Date().toISOString(),
    summary,
    records,
    stagingPayloads: buildStagingPayloads(records, sourceName)
  };
}

export function buildStagingPayloads(records, sourceName = "notion-markdown-export") {
  return {
    domesticSuppliers: {
      sourceName: `${sourceName}:domestic_suppliers`,
      targetTable: "domestic_suppliers",
      rows: records.map((record) => record.supplierRow)
    },
    supplierProductsRelationshipRows: records.flatMap((record) =>
      record.productRows.map((product) => ({
        supplierLookupKey: record.supplierLookupKey,
        productLookupKey: product.productLookupKey,
        row: product.row
      }))
    ),
    supplierPricesRelationshipRows: records.flatMap((record) =>
      record.productRows.flatMap((product) =>
        product.priceRows.map((price) => ({
          supplierLookupKey: record.supplierLookupKey,
          productLookupKey: product.productLookupKey,
          row: price.row
        }))
      )
    ),
    supplierMediaRelationshipRows: records.flatMap((record) => record.mediaRows)
  };
}

function extractTitle(lines, sourcePath) {
  const heading = lines.find((line) => line.trim().startsWith("# "));
  if (heading) return heading.replace(/^#\s+/, "").trim();
  const fileName = sourcePath ? sourcePath.split(/[\\/]/).pop() : "";
  return fileName ? fileName.replace(/\s+[0-9a-f]{32}\.md$/i, "").replace(/\.md$/i, "") : "Untitled Notion Page";
}

function parseProperties(lines) {
  const properties = {};
  let lastKey = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("![") || isMediaLink(trimmed)) {
      lastKey = null;
      continue;
    }

    const match = trimmed.match(/^(.{1,80}?):\s*(.*)$/u);
    if (match) {
      const key = normalizePropertyKey(match[1]);
      properties[key] = match[2].trim();
      lastKey = key;
      continue;
    }

    // Notion의 multi-select/text 속성은 다음 줄로 이어지는 경우가 있어 상품 목록만 보존합니다.
    if (lastKey && /상품 목록|product/i.test(lastKey)) {
      properties[lastKey] = compactJoin([properties[lastKey], trimmed], "\n");
    }
  }

  return properties;
}

function parseBodyText(lines) {
  const bodyLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("![") || isMediaLink(trimmed)) continue;
    if (/^(.{1,80}?):\s*(.*)$/u.test(trimmed)) continue;
    bodyLines.push(trimmed);
  }
  return bodyLines.join("\n").trim();
}

function parseMediaReferences(content, { baseDir, pageId, title }) {
  const media = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;

  for (const match of content.matchAll(imageRegex)) {
    const href = decodeHref(match[2]);
    media.push(buildMediaReference({ label: match[1], href, baseDir, pageId, title, sortOrder: media.length + 1 }));
  }

  for (const match of content.matchAll(linkRegex)) {
    const href = decodeHref(match[2]);
    if (!MEDIA_EXTENSIONS.has(getExtension(href))) continue;
    media.push(buildMediaReference({ label: match[1], href, baseDir, pageId, title, sortOrder: media.length + 1 }));
  }

  return media;
}

function buildMediaReference({ label, href, baseDir, pageId, title, sortOrder }) {
  const fileName = href.split(/[\\/]/).pop() ?? href;
  const extension = getExtension(fileName);
  const mediaType = MEDIA_EXTENSIONS.get(extension) ?? "file";
  const safeFileName = sanitizeStorageFileName(fileName);
  const storageBase = pageId || stableSlug(title);

  return {
    label: label?.trim() || fileName,
    href,
    mediaType,
    sourceFile: baseDir && !/^https?:\/\//i.test(href) ? `${baseDir.replace(/[\\/]$/, "")}/${href}` : href,
    storagePath: `notion/${storageBase}/${String(sortOrder).padStart(2, "0")}-${safeFileName}`
  };
}

function parseProductEntries(properties, title) {
  const productList = pickFirst(properties, ["상품 목록", "Product List"]);
  const productText = pickFirst(properties, ["상품 목록 (텍스트)", "Product Text"]);
  const sources = [];

  if (productList) sources.push(...productList.split(/\s*,\s*/).filter(Boolean));
  if (sources.length === 0 && productText) sources.push(...productText.split(/\n+/).filter(Boolean));

  return sources.map((source) => {
    const cleaned = source.replace(/\s*\(https?:\/\/[^)]+\)\s*$/i, "").split(">>>").pop()?.trim() ?? source.trim();
    const match = cleaned.match(/^(.*?)\s*\(([^)]+)\)$/u);
    const rawKo = (match?.[1] ?? cleaned).replace(/^\[[^\]]+\]\s*/, "").trim();
    const nameEn = match?.[2]?.trim() ?? null;
    const nameKo = rawKo.length <= 4 && nameEn ? `${title} ${rawKo} - ${nameEn}` : rawKo || title;
    return {
      productType: inferProductType(source, properties),
      nameKo,
      nameEn,
      menuTags: parseTags(properties)
    };
  });
}

function buildFallbackProductEntry(title, category) {
  return {
    productType: category === "restaurant" ? "meal" : category === "vehicle" ? "vehicle" : category === "guide" ? "guide_service" : "ticket",
    nameKo: `${title} 기본 상품`,
    nameEn: null,
    menuTags: []
  };
}

function buildPriceRows({ document, productLookupKey, supplierProductId }) {
  const admission = pickFirst(document.properties, ["관람료", "입장료", "요금", "가격"]);
  const amount = parseKrwAmount(admission);
  if (amount === null) return [];

  return [
    {
      priceLookupKey: `${productLookupKey}:price:1`,
      row: stripNullValues({
        supplier_product_id: supplierProductId ?? DEFAULT_SUPPLIER_PRODUCT_ID,
        pricing_unit: "per_person",
        currency: "KRW",
        cost_amount: amount,
        includes_tax: true,
        notes: admission ? `Notion 원문 관람료: ${admission}` : "Notion markdown import"
      })
    }
  ];
}

function buildDescription(document) {
  const properties = document.properties;
  return compactJoin(
    [
      propertyLine("컨텐츠 유형", pickFirst(properties, ["컨텐츠 유형", "콘텐츠 유형"])),
      propertyLine("주소", pickFirst(properties, ["주소"])),
      propertyLine("관람료", pickFirst(properties, ["관람료", "입장료", "요금", "가격"])),
      propertyLine("주차", pickFirst(properties, ["주차"])),
      propertyLine("화장실", pickFirst(properties, ["화장실"])),
      document.bodyText
    ],
    "\n"
  );
}

function buildSupplierInternalNotes(document) {
  const properties = document.properties;
  return compactJoin(
    [
      `Notion page id: ${document.pageId ?? "unknown"}`,
      propertyLine("생성자", pickFirst(properties, ["생성자"])),
      propertyLine("생성 일시", pickFirst(properties, ["생성 일시"])),
      propertyLine("최종 편집자", pickFirst(properties, ["최종 편집자"])),
      propertyLine("최종 편집 일시", pickFirst(properties, ["최종 편집 일시"])),
      propertyLine("확인 가능자", pickFirst(properties, ["확인 가능자"])),
      propertyLine("사용 여부", pickFirst(properties, ["사용 여부"])),
      propertyLine("업데이트 상태", pickFirst(properties, ["업데이트 상태"])),
      propertyLine("추출 상태", pickFirst(properties, ["추출 상태"])),
      propertyLine("상품 목록", pickFirst(properties, ["상품 목록"])),
      propertyLine("상품 목록 텍스트", pickFirst(properties, ["상품 목록 (텍스트)"]))
    ],
    "\n"
  );
}

function buildWarnings({ supplierRow, productRows }) {
  const warnings = [];
  if (supplierRow.company_id === DEFAULT_COMPANY_ID) {
    warnings.push("company_id가 미지정 상태입니다. Supabase 삽입 전 실제 JHT company UUID로 교체해야 합니다.");
  }
  for (const product of productRows) {
    if (product.row.domestic_supplier_id === DEFAULT_DOMESTIC_SUPPLIER_ID) {
      warnings.push(`${product.productLookupKey}: domestic_supplier_id는 공급사 생성 후 실제 UUID로 교체해야 합니다.`);
    }
    for (const price of product.priceRows) {
      if (price.row.supplier_product_id === DEFAULT_SUPPLIER_PRODUCT_ID) {
        warnings.push(`${price.priceLookupKey}: supplier_product_id는 상품 생성 후 실제 UUID로 교체해야 합니다.`);
      }
    }
  }
  return warnings;
}

function summarizeRecords(records) {
  return {
    supplierCount: records.length,
    productCount: records.reduce((sum, record) => sum + record.productRows.length, 0),
    priceCount: records.reduce((sum, record) => sum + record.productRows.reduce((inner, product) => inner + product.priceRows.length, 0), 0),
    mediaCount: records.reduce((sum, record) => sum + record.mediaRows.length, 0),
    warningCount: records.reduce((sum, record) => sum + record.warnings.length, 0)
  };
}

function inferSupplierCategory(properties) {
  const joined = compactJoin([pickFirst(properties, ["파트너사 구분"]), pickFirst(properties, ["컨텐츠 유형", "콘텐츠 유형"])], " ").toLowerCase();
  if (/hotel|호텔/.test(joined)) return "hotel";
  if (/vehicle|차량|버스|coach|van/.test(joined)) return "vehicle";
  if (/restaurant|meal|식당|식사|메뉴|할랄|halal/.test(joined)) return "restaurant";
  if (/guide|가이드/.test(joined)) return "guide";
  if (/tour site|attraction|관광|투어|체험|ticket|입장/.test(joined)) return "attraction";
  return "other";
}

function inferProductType(source, properties) {
  const joined = compactJoin([source, pickFirst(properties, ["파트너사 구분"]), pickFirst(properties, ["컨텐츠 유형", "콘텐츠 유형"])], " ").toLowerCase();
  if (/room|객실|숙박/.test(joined)) return "room";
  if (/vehicle|차량|버스|coach|van/.test(joined)) return "vehicle";
  if (/meal|menu|식사|메뉴|restaurant/.test(joined)) return "meal";
  if (/guide|가이드/.test(joined)) return "guide_service";
  if (/meeting|banquet|연회|회의/.test(joined)) return "meeting_room";
  if (/ticket|tour site|attraction|관광|투어|체험|입장/.test(joined)) return "ticket";
  return "other";
}

function inferRecordStatus(properties) {
  const usage = pickFirst(properties, ["사용 여부", "Status", "상태"]);
  if (!usage) return "active";
  if (/확인 필요|inactive|미사용|중지|보류/i.test(usage)) return "inactive";
  if (/archive|삭제|폐기/i.test(usage)) return "archived";
  return "active";
}

function parseTags(properties) {
  const contentType = pickFirst(properties, ["컨텐츠 유형", "콘텐츠 유형"]);
  if (!contentType) return [];
  return contentType
    .split(/[,\n/]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseKrwAmount(value) {
  if (!value) return null;
  if (/무료|free/i.test(value)) return 0;
  const match = String(value).replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function pickFirst(properties, keys) {
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function propertyLine(label, value) {
  return value ? `${label}: ${value}` : null;
}

function compactJoin(values, separator) {
  return values
    .flat()
    .filter((value) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map((value) => String(value).trim())
    .join(separator);
}

function normalizePropertyKey(key) {
  return key.replace(/^\*\s*/, "").trim();
}

function stripNullValues(row) {
  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== ""));
}

function isMediaLink(line) {
  const match = line.match(/^\[[^\]]+\]\(([^)]+)\)$/);
  return Boolean(match && MEDIA_EXTENSIONS.has(getExtension(decodeHref(match[1]))));
}

function getExtension(value) {
  const clean = value.split("?")[0].split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  return dotIndex >= 0 ? clean.slice(dotIndex).toLowerCase() : "";
}

function decodeHref(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function sanitizeStorageFileName(fileName) {
  return fileName.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "") || "media";
}

function stableSlug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePageIdFromPath(sourcePath) {
  const match = sourcePath.match(/([0-9a-f]{32})\.md$/i);
  return match?.[1] ?? null;
}
