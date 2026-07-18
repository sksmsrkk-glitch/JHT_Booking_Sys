/**
 * @file 한글 책임: `xlsx` 도메인의 프레임워크 독립적인 계산·검증·상태 전이 규칙을 구현합니다.
 * API와 UI가 같은 업무 결정을 사용하도록 순수 함수 중심으로 유지하며, 금액·권한·멱등성 관련 예외를 호출자에게 명확히 전달합니다.
 */
/**
 * 최소 XLSX 생성기입니다.
 *
 * 서버 API에서 견적서/인보이스/공급사 원가표를 바로 다운로드해야 하므로,
 * 현재는 외부 엑셀 라이브러리에 강하게 의존하지 않고 Office Open XML 파일을 직접 만듭니다.
 * 복잡한 서식보다 "엑셀에서 열리는 안정적인 데이터 파일"을 우선합니다.
 *
 * 향후 고급 서식, 병합 셀, 이미지 삽입이 필요해지면 이 계층을 xlsx 라이브러리로
 * 교체하되, 상위 함수(buildInvoiceWorkbook 등)의 입력 구조는 유지하는 것이 좋습니다.
 */
const XLSX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const WORKBOOK_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Quote Export" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export function buildQuoteExportWorkbook({ summary, itineraryDays = [], items = [] }) {
  // 내부 관리자용 견적 export입니다.
  // partner-safe 문서가 아니라 내부 스냅샷 확인용이므로 supplier/cost/margin 정보가 포함됩니다.
  const rows = [
    ["Jungho Travel Quote Export"],
    ["Case Code", summary.caseCode ?? ""],
    ["Tour Name", summary.tourName ?? ""],
    ["Version", summary.versionNo ?? ""],
    ["Status", summary.status ?? ""],
    ["Currency", summary.currency ?? ""],
    ["Public Total", summary.publicTotalAmount ?? 0],
    [],
    ["Itinerary"],
    ["Day", "Date", "Title", "Public Description", "Route Count"],
    ...itineraryDays.map((day) => [
      day.dayNo ?? "",
      day.serviceDate ?? "",
      day.title ?? "",
      day.publicDescription ?? "",
      Array.isArray(day.routeSegments) ? day.routeSegments.length : 0
    ]),
    [],
    ["Internal Snapshot Items"],
    ["Category", "Item", "Supplier", "Unit Cost", "Qty", "Pax", "Cost KRW", "Sell Amount", "Margin"],
    ...items.map((item) => [
      item.itemCategory ?? "",
      item.snapshotItemName ?? "",
      item.snapshotSupplierName ?? "",
      Number(item.snapshotUnitCostAmount ?? 0),
      Number(item.quantity ?? 0),
      item.paxCount ?? "",
      Number(item.totalCostKrw ?? 0),
      Number(item.totalSellAmount ?? 0),
      Number(item.totalSellAmount ?? 0) - Number(item.totalCostKrw ?? 0)
    ])
  ];

  return createXlsxBuffer(rows);
}

export function buildInvoiceWorkbook({ invoice, remainingAmount = 0 }) {
  // 파트너/회계가 함께 보는 인보이스 export입니다.
  // 최종 확정 일정, 라인아이템, 결제 내역, 계좌 정보를 한 파일에 담습니다.
  const bank = invoice.bankAccountSnapshot ?? {};
  const rows = [
    ["JUNGHOTRAVEL INVOICE"],
    ["Invoice No", invoice.invoiceNo],
    ["Tour Code", invoice.tourCode ?? ""],
    ["Version", invoice.versionNo ?? ""],
    ["Status", invoice.status ?? ""],
    ["Collection Status", invoice.collectionStatus ?? ""],
    ["Agency", invoice.agencyName ?? ""],
    ["Tour Name", invoice.tourName ?? ""],
    ["Reservation", invoice.reservationCode ?? invoice.reservationId ?? ""],
    ["Issued At", invoice.issuedAt ?? ""],
    ["Due Date", invoice.paymentDeadline ?? invoice.dueDate ?? ""],
    ["Currency", invoice.currency ?? ""],
    ["Invoice Total", Number(invoice.totalAmount ?? 0)],
    ["Confirmed Paid", Number(invoice.confirmedPaymentTotal ?? 0)],
    ["Remaining", Number(remainingAmount ?? 0)],
    ["Deposit Required", invoice.depositRequired ? "Yes" : "No"],
    ["Deposit Amount", Number(invoice.depositAmount ?? 0)],
    [],
    ["Line Items"],
    ["No", "Service Date", "Category", "Description", "Unit", "Quantity", "Unit Label", "Currency", "Total", "Notes"],
    ...(invoice.lineItems ?? []).map((item) => [
      item.lineNo ?? "",
      item.serviceDate ?? "",
      item.category ?? "",
      item.description ?? "",
      Number(item.unitAmount ?? 0),
      Number(item.quantity ?? 0),
      item.unitLabel ?? "",
      item.currency ?? invoice.currency ?? "",
      Number(item.totalAmount ?? 0),
      item.notes ?? ""
    ]),
    [],
    ["Confirmed Itinerary"],
    ["Day", "Date", "Title", "Hotel", "Breakfast", "Lunch", "Dinner", "Attractions", "Description", "Special Notes"],
    ...(invoice.itinerarySnapshot ?? []).map((day) => [
      day.day ?? day.dayNo ?? "",
      day.date ?? day.serviceDate ?? "",
      day.title ?? "",
      day.hotel ?? "",
      normalizeMeal(day.meals, "breakfast"),
      normalizeMeal(day.meals, "lunch"),
      normalizeMeal(day.meals, "dinner"),
      Array.isArray(day.attractions) ? day.attractions.join(", ") : day.attractions ?? "",
      day.description ?? "",
      day.specialNotes ?? ""
    ]),
    [],
    ["Flight Details"],
    ["Type", "Flight No", "Date", "Time", "Route"],
    ...(invoice.flightDetails ?? []).map((flight) => [
      flight.type ?? "",
      flight.flightNo ?? "",
      flight.date ?? "",
      flight.time ?? "",
      flight.route ?? ""
    ]),
    [],
    ["Payment Records"],
    ["Status", "Method", "Currency", "Amount", "Received At", "Reference"],
    ...(invoice.payments ?? []).map((payment) => [
      payment.status ?? "",
      payment.method ?? "",
      payment.currency ?? invoice.currency ?? "",
      Number(payment.amount ?? 0),
      payment.receivedAt ?? "",
      payment.referenceNo ?? ""
    ]),
    [],
    ["Bank / Payment"],
    ["Payable To", bank.payableTo ?? ""],
    ["Bank Name", bank.bankName ?? ""],
    ["Account No", bank.accountNo ?? ""],
    ["Swift Code", bank.swiftCode ?? ""],
    ["Remark", bank.remark ?? ""]
  ];

  return createXlsxBuffer(rows, { sheetName: "Invoice" });
}

export function createXlsxBuffer(rows, options = {}) {
  // rows 배열을 단일 worksheet XLSX 패키지로 감쌉니다.
  // zipStore는 압축 없이 store 방식으로 묶으므로 구현은 단순하지만 엑셀 호환성은 유지됩니다.
  const sheetName = options.sheetName ?? "Quote Export";
  const now = new Date().toISOString();
  const files = [
    { path: "[Content_Types].xml", content: XLSX_CONTENT_TYPES },
    { path: "_rels/.rels", content: ROOT_RELS },
    { path: "xl/workbook.xml", content: buildWorkbookXml(sheetName) },
    { path: "xl/_rels/workbook.xml.rels", content: WORKBOOK_RELS },
    { path: "xl/styles.xml", content: STYLES_XML },
    { path: "xl/worksheets/sheet1.xml", content: buildSheetXml(rows) },
    { path: "docProps/core.xml", content: buildCoreProps(now) },
    { path: "docProps/app.xml", content: buildAppProps() }
  ];

  return zipStore(files);
}

function buildWorkbookXml(sheetName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildSheetXml(rows) {
  // 모든 셀은 숫자 또는 inline string으로 기록합니다.
  // sharedStrings를 만들지 않아도 되므로 작은 운영용 파일을 빠르게 생성할 수 있습니다.
  const rowXml = rows
    .map((row, rowIndex) => {
      const rowNo = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => buildCellXml(rowNo, columnIndex + 1, value))
        .join("");
      return `<row r="${rowNo}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function buildCellXml(rowNo, columnNo, value) {
  const ref = `${columnName(columnNo)}${rowNo}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
}

function normalizeMeal(meals, key) {
  if (!meals || typeof meals !== "object" || Array.isArray(meals)) return "";
  return meals[key] ?? "";
}

function columnName(index) {
  let name = "";
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function buildCoreProps(now) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Jungho Travel Operations Platform</dc:creator>
  <cp:lastModifiedBy>Jungho Travel Operations Platform</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function buildAppProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Jungho Travel Operations Platform</Application>
</Properties>`;
}

function zipStore(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path);
    const content = Buffer.from(file.content);
    const crc = crc32(content);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
