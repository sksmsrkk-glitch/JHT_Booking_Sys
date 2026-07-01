import type { Route } from "next";
import Link from "next/link";
import { CountryReferenceCreateForm } from "@/components/admin/CountryReferenceCreateForm";
import { ExchangeRateCreateForm } from "@/components/admin/ExchangeRateCreateForm";
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

  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Internal Admin</p>
          <h1>Exchange Rates</h1>
          <p>Central KRW exchange-rate management for quotes, supplier cost snapshots, invoices, and settlement checks.</p>
        </div>
        <Link className="button-secondary" href={"/admin" as Route}>
          Back to Admin
        </Link>
      </div>

      <form className="toolbar" action="/admin/exchange-rates">
        <label>
          Country Code
          <input name="countryCode" defaultValue={filters.countryCode ?? ""} placeholder="TH, MY, SG, PH" />
        </label>
        <label>
          Base Currency
          <input name="baseCurrency" defaultValue={filters.baseCurrency ?? ""} placeholder="USD, SGD, KRW" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={filters.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button className="button-primary" type="submit">
          Filter
        </button>
      </form>

      <section className="panel-section">
        <div className="section-heading">
          <h2>Common Country Master</h2>
          <span>Country code + default name</span>
        </div>
        <CountryReferenceCreateForm />
      </section>

      {loadState.status === "ready" ? <CountryReferenceTable countries={loadState.countries} /> : null}

      <section className="panel-section">
        <div className="section-heading">
          <h2>Create Exchange Rate</h2>
          <span>Country-linked FX</span>
        </div>
        <ExchangeRateCreateForm />
      </section>

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
        <h2>Usage Rule</h2>
        <p>
          Quote and finance forms should load the latest active rate, then save that rate as a snapshot on the quote or finance
          record. Existing quotes must not recalculate automatically when the common rate changes.
        </p>
      </section>
    </>
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
    <section className="table-shell" aria-label="Country references">
      <table>
        <thead>
          <tr>
            <th>Country Code</th>
            <th>Country Name</th>
            <th>Default Currency</th>
            <th>Aliases</th>
            <th>Source</th>
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
    <section className="table-shell" aria-label="Exchange rates">
      <table>
        <thead>
          <tr>
            <th>Currency</th>
            <th>Country</th>
            <th>Rate</th>
            <th>Effective Date</th>
            <th>Source</th>
            <th>Status</th>
            <th>Notes</th>
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
                <span className={`status-dot status-${rate.status}`}>{formatLabel(rate.status)}</span>
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

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
