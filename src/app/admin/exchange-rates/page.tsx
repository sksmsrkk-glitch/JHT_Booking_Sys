import type { Route } from "next";
import Link from "next/link";
import { CountryReferenceCreateForm } from "@/components/admin/CountryReferenceCreateForm";
import { ExchangeRateCreateForm } from "@/components/admin/ExchangeRateCreateForm";
import { ExchangeRateFilterForm } from "@/components/admin/ExchangeRateFilterForm";
import { mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";
import type { ExchangeRateListItem } from "@/features/exchange-rates/types";
import { getPageAuthorization } from "@/lib/api/page-session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  countryCode?: string;
  baseCurrency?: string;
  status?: string;
}>;

type LoadState =
  | { status: "ready"; rates: ExchangeRateListItem[]; countries: CountryReference[] }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

export default async function ExchangeRatesPage({ searchParams }: { searchParams: SearchParams }) {
  const filters = await searchParams;
  const loadState = await loadExchangeRates(filters);
  const countryOptions = mergeCountryReferences(loadState.status === "ready" ? loadState.countries : []);

  return (
    <div className="exchange-rate-page">
      <div className="page-header">
        <div>
          <p className="eyebrow">내부 관리자</p>
          <h1>환율 관리</h1>
          <p>견적, 공급사 원가, 인보이스, 정산에 공통 적용되는 국가별 기준 통화와 KRW 환산율을 관리합니다.</p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>
          관리자 홈
        </Link>
      </div>

      <ExchangeRateFilterForm countries={countryOptions} filters={filters} />

      <div className="exchange-rate-admin-grid">
        <section className="panel-section exchange-rate-card-panel">
          <div className="section-heading">
            <h2>국가 공통 마스터</h2>
            <span>국가 코드 + 기본 통화</span>
          </div>
          <CountryReferenceCreateForm countries={countryOptions} />
        </section>

        <section className="panel-section exchange-rate-card-panel">
          <div className="section-heading">
            <h2>환율 등록</h2>
            <span>국가별 KRW 환산율</span>
          </div>
          <ExchangeRateCreateForm countries={countryOptions} />
        </section>
      </div>

      {loadState.status === "ready" ? <CountryReferenceTable countries={loadState.countries} /> : null}

      {loadState.status === "auth-required" ? (
        <section className="notice warning">
          <h2>Internal role required</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="notice danger">
          <h2>Exchange rates could not load</h2>
          <p>{loadState.message}</p>
        </section>
      ) : null}

      {loadState.status === "ready" ? <ExchangeRateTable rates={loadState.rates} /> : null}

      <section className="notice">
        <h2>적용 원칙</h2>
        <p>
          견적과 회계 화면은 최신 운영 환율을 불러오되, 확정된 견적/정산에는 당시 환율을 스냅샷으로 저장합니다.
          공통 환율이 바뀌어도 기존 확정 견적 금액은 자동 재계산하지 않습니다.
        </p>
      </section>
    </div>
  );
}

function CountryReferenceTable({ countries }: { countries: CountryReference[] }) {
  if (countries.length === 0) {
    return (
      <section className="empty-state compact">
        <p>No country master records yet. Saving a country or country-linked exchange rate will create one.</p>
      </section>
    );
  }

  return (
    <section className="table-shell compact-data-table" aria-label="Country references">
      <table>
        <thead>
          <tr>
            <th>국가 코드</th>
            <th>국가명</th>
            <th>기본 통화</th>
            <th>별칭</th>
            <th>출처</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((country) => (
            <tr key={country.countryCode}>
              <td>
                <strong>{country.countryCode}</strong>
              </td>
              <td>{country.countryName}</td>
              <td>{country.defaultCurrency ?? "-"}</td>
              <td>{country.aliases.length > 0 ? country.aliases.join(", ") : "-"}</td>
              <td>{country.source}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ExchangeRateTable({ rates }: { rates: ExchangeRateListItem[] }) {
  if (rates.length === 0) {
    return (
      <section className="empty-state">
        <h2>No exchange rates found</h2>
        <p>Create the first active currency rate before using non-KRW quote item costs.</p>
      </section>
    );
  }

  return (
    <section className="table-shell compact-data-table" aria-label="Exchange rates">
      <table>
        <thead>
          <tr>
            <th>통화</th>
            <th>국가</th>
            <th>환산율</th>
            <th>적용일</th>
            <th>출처</th>
            <th>상태</th>
            <th>메모</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id}>
              <td>
                <strong>{rate.baseCurrency}</strong>
                <span className="subtext">to {rate.quoteCurrency}</span>
              </td>
              <td>
                {rate.countryCode ?? "Global"}
                {rate.countryName ? <span className="subtext">{rate.countryName}</span> : null}
              </td>
              <td>{rate.rate.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
              <td>{rate.effectiveDate}</td>
              <td>{rate.source ?? "-"}</td>
              <td>
                <span className={`status-dot status-${rate.status}`}>{formatStatusLabel(rate.status)}</span>
              </td>
              <td>{rate.notes ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

async function loadExchangeRates(filters: { countryCode?: string; baseCurrency?: string; status?: string }): Promise<LoadState> {
  const { authorization, headerStore } = await getPageAuthorization();
  if (!authorization) {
    return {
      status: "auth-required",
      message: "This page reads exchange rates through the internal API, which requires a Supabase user JWT with an internal role."
    };
  }

  const [rateResponse, countryResponse] = await Promise.all([
    fetch(buildInternalApiUrl("/api/exchange-rates", filters, headerStore), {
      headers: { authorization },
      cache: "no-store"
    }),
    fetch(buildInternalApiUrl("/api/countries", {}, headerStore), {
      headers: { authorization },
      cache: "no-store"
    })
  ]);
  const [ratePayload, countryPayload] = await Promise.all([rateResponse.json(), countryResponse.json()]);
  const failedResponse = [rateResponse, countryResponse].find((response) => !response.ok);
  if (failedResponse) {
    return {
      status: failedResponse.status === 401 || failedResponse.status === 403 ? "auth-required" : "error",
      message: ratePayload.error ?? countryPayload.error ?? "Unknown exchange-rate API error"
    };
  }

  return { status: "ready", rates: ratePayload.data ?? [], countries: countryPayload.data ?? [] };
}

function buildInternalApiUrl(path: string, filters: { countryCode?: string; baseCurrency?: string; status?: string }, headerStore: Headers) {
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host") ?? "localhost:3000";
  const url = new URL(path, `${protocol}://${host}`);
  if (filters.countryCode) url.searchParams.set("countryCode", filters.countryCode);
  if (filters.baseCurrency) url.searchParams.set("baseCurrency", filters.baseCurrency);
  if (filters.status) url.searchParams.set("status", filters.status);
  return url;
}

function formatStatusLabel(value: string) {
  const labels: Record<string, string> = {
    active: "운영중",
    inactive: "비활성",
    archived: "보관"
  };
  return labels[value] ?? value;
}
