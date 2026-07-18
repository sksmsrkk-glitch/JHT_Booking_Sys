/**
 * @file 한글 책임: `Domestic Supplier Excel Actions` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { useState } from "react";
import type { CompanyListItem } from "@/features/company/types";

export function DomesticSupplierExcelActions({ companies }: { companies: CompanyListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch("/api/domestic-suppliers/import-xlsx", {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Excel import failed");
      setIsBusy(false);
      return;
    }
    setMessage(
      `Imported ${result.data.rows} row(s): ${result.data.supplierCount} supplier(s), ${result.data.productCount} item(s), ${result.data.priceCount} price row(s), ${result.data.mediaCount} image(s).`
    );
    setIsBusy(false);
  }

  return (
    <div className="excel-actions">
      <div className="inline-actions">
        <a className="button-secondary" href="/api/domestic-suppliers/excel-template">
          Download Template
        </a>
        <a className="button-secondary" href="/api/domestic-suppliers/export-xlsx">
          Export All Suppliers
        </a>
      </div>
      <form action={submit} className="stacked-form">
        <div className="form-grid three-column">
          <label>
            Company
            <select disabled={isBusy} name="companyId" required>
              <option value="">Select company for new suppliers</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.code} - {company.nameKo}
                </option>
              ))}
            </select>
          </label>
          <label>
            Excel File
            <input
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBusy}
              name="file"
              required
              type="file"
            />
          </label>
        </div>
        <div className="inline-actions">
          <button className="button-primary" disabled={isBusy} type="submit">
            Import Excel
          </button>
          {message ? <span className={message.startsWith("Imported") ? "success-text" : "danger-text"}>{message}</span> : null}
        </div>
      </form>
    </div>
  );
}
