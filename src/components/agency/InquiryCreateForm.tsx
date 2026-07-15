"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildCurrencyOptions, DEFAULT_COUNTRY_REFERENCES, mergeCountryReferences } from "@/features/countries/defaults";
import type { CountryReference } from "@/features/countries/types";

const inquiryTypes = [
  "new_inquiry",
  "revision_request",
  "change_request",
  "cancellation_request",
  "booking_request",
  "existing_product_inquiry"
];

const tourTypes = ["", "series_package", "incentive_tour", "private_tour", "mice", "other"];
const initialCountryOptions = mergeCountryReferences(DEFAULT_COUNTRY_REFERENCES);

export function InquiryCreateForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryOptions, setCountryOptions] = useState<CountryReference[]>(initialCountryOptions);
  const [selectedCountryCode, setSelectedCountryCode] = useState("MY");
  const [billingCurrency, setBillingCurrency] = useState("MYR");
  const [agencyName, setAgencyName] = useState("Agency");
  const [hasAgencyContext, setHasAgencyContext] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const selectedCountry = countryOptions.find((country) => country.countryCode === selectedCountryCode);
  const currencyOptions = useMemo(() => buildCurrencyOptions(countryOptions, selectedCountry?.defaultCurrency ?? billingCurrency), [
    billingCurrency,
    countryOptions,
    selectedCountry?.defaultCurrency
  ]);
  const submittedDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/agency/context").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/countries").then((response) => (response.ok ? response.json() : null))
    ])
      .then(([contextPayload, countriesPayload]) => {
        if (!mounted) return;
        const merged = mergeCountryReferences(countriesPayload?.data ?? []);
        setCountryOptions(merged);
        if (contextPayload?.data) {
          setAgencyName(contextPayload.data.agencyName);
          setSelectedCountryCode(contextPayload.data.countryCode);
          setBillingCurrency(contextPayload.data.billingCurrency);
          setHasAgencyContext(true);
          return;
        }
        const nextCountry = merged.find((country) => country.countryCode === selectedCountryCode) ?? merged[0];
        setSelectedCountryCode(nextCountry?.countryCode ?? "MY");
        setBillingCurrency(nextCountry?.defaultCurrency ?? "KRW");
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  function selectCountry(countryCode: string) {
    const country = countryOptions.find((item) => item.countryCode === countryCode);
    setSelectedCountryCode(country?.countryCode ?? "");
    setBillingCurrency(country?.defaultCurrency ?? "KRW");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setIsSubmitting(true);
    setMessage("");

    const form = new FormData(formElement);
    const countryCode = selectedCountryCode;
    const normalizedBillingCurrency = String(form.get("billingCurrency") ?? billingCurrency).trim().toUpperCase() || "KRW";
    const flightDetails = [
      {
        direction: "arrival",
        flightNo: String(form.get("arrivalFlightNo") ?? "").trim(),
        route: String(form.get("arrivalRoute") ?? "").trim(),
        time: String(form.get("arrivalFlightTime") ?? "").trim()
      },
      {
        direction: "departure",
        flightNo: String(form.get("departureFlightNo") ?? "").trim(),
        route: String(form.get("departureRoute") ?? "").trim(),
        time: String(form.get("departureFlightTime") ?? "").trim()
      }
    ].filter((flight) => flight.flightNo || flight.route || flight.time);

    const payload = {
      inquiryType: form.get("inquiryType"),
      title: form.get("title"),
      countryCode,
      agencyName,
      billingCurrency: normalizedBillingCurrency,
      submittedDate,
      arrivalDate: form.get("arrivalDate"),
      departureDate: form.get("departureDate"),
      periodText: form.get("periodText"),
      nightsCount: form.get("nightsCount"),
      paxCount: form.get("paxCount"),
      preferredLanguage: form.get("preferredLanguage"),
      tourType: form.get("tourType"),
      relatedTourCode: form.get("relatedTourCode"),
      requestPayload: {
        countryCode,
        countryName: selectedCountry?.countryName,
        billingCurrency: normalizedBillingCurrency,
        agencyName,
        submittedDate,
        periodText: form.get("periodText"),
        nightsCount: form.get("nightsCount"),
        arrivalDate: form.get("arrivalDate"),
        departureDate: form.get("departureDate"),
        flightDetails,
        itineraryText: form.get("itineraryText"),
        changeSummary: form.get("changeSummary"),
        cancellationReason: form.get("cancellationReason"),
        notes: form.get("notes")
      }
    };

    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    try {
      const response = await fetch("/api/agency/inquiries", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Inquiry submission failed");
        setIsSubmitting(false);
        return;
      }

      idempotencyKeyRef.current = null;
      setMessage(`Inquiry submitted. Tour code: ${result.data?.tourCode ?? result.data?.tour_code ?? "Created"}`);
      formElement.reset();
      setIsSubmitting(false);
    } catch {
      // 네트워크 오류 재시도 시 같은 키를 유지해 이미 저장된 문의가 중복 생성되지 않게 합니다.
      setMessage("Network error while submitting the inquiry. Please retry.");
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <div className="section-heading">
        <h2>New Inquiry</h2>
        <span>Inquiry date: {submittedDate}</span>
      </div>
      <div className="form-preview">
        <label>
          Inquiry Type
          <select name="inquiryType" defaultValue="new_inquiry" required>
            {inquiryTypes.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tour Title / Group Name
          <input name="title" placeholder="Seoul and Busan incentive tour" required />
        </label>
        <label>
          Number of Pax
          <input min="1" name="paxCount" placeholder="20" required type="number" />
        </label>
        <label>
          Period
          <input name="periodText" placeholder="24-28 Mar 2026 or around late March" required />
        </label>
        <label>
          Nights in Korea
          <input min="1" name="nightsCount" placeholder="4" required type="number" />
        </label>
        <label>
          Arrival Date
          <input name="arrivalDate" type="date" />
        </label>
        <label>
          Departure Date
          <input name="departureDate" type="date" />
        </label>
        <label>
          Preferred Language
          <input name="preferredLanguage" placeholder="English" />
        </label>
        <label>
          Partner Country
          <select disabled={hasAgencyContext} name="countryCode" required value={selectedCountryCode} onChange={(event) => selectCountry(event.target.value)}>
            {countryOptions.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.countryCode} - {country.countryName}
                {country.defaultCurrency ? ` (${country.defaultCurrency})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Billing Currency / FX Base
          <select disabled={hasAgencyContext} name="billingCurrency" value={billingCurrency} onChange={(event) => setBillingCurrency(event.target.value)}>
            {currencyOptions.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        <label>
          Agency Name
          <input name="agencyName" readOnly={hasAgencyContext} value={agencyName} onChange={(event) => setAgencyName(event.target.value)} />
        </label>
        <label>
          Related Tour Code
          <input name="relatedTourCode" placeholder="For revision/cancellation requests" />
        </label>
        <label>
          Tour Type
          <select name="tourType" defaultValue="">
            {tourTypes.map((type) => (
              <option key={type || "blank"} value={type}>
                {type ? formatLabel(type) : "Not set"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <section className="nested-form-section">
        <h3>Flight Details</h3>
        <div className="form-grid three-column">
          <label>
            Arrival Flight No.
            <input name="arrivalFlightNo" placeholder="KE672" />
          </label>
          <label>
            Arrival Route
            <input name="arrivalRoute" placeholder="KUL / ICN" />
          </label>
          <label>
            Arrival Time
            <input name="arrivalFlightTime" placeholder="2355-0715+1" />
          </label>
          <label>
            Departure Flight No.
            <input name="departureFlightNo" placeholder="MH67" />
          </label>
          <label>
            Departure Route
            <input name="departureRoute" placeholder="ICN / KUL" />
          </label>
          <label>
            Departure Time
            <input name="departureFlightTime" placeholder="1100-1635" />
          </label>
        </div>
      </section>
      <label className="full-width-field">
        Itinerary / Program Request
        <textarea name="itineraryText" placeholder="Paste the requested sightseeing, meals, hotel class, route, and special program details." rows={4} />
      </label>
      <label className="full-width-field">
        Change Request Details
        <textarea name="changeSummary" placeholder="For revision/change requests: date change, hotel/restaurant/attraction change, nights change, pax change, etc." rows={3} />
      </label>
      <label className="full-width-field">
        Cancellation Reason
        <textarea name="cancellationReason" placeholder="For cancellation requests: reason and any related tour code." rows={3} />
      </label>
      <label className="full-width-field">
        Notes
        <textarea name="notes" placeholder="Other special requests or partner comments" rows={3} />
      </label>
      <button className="button-primary" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Submitting..." : "Submit Inquiry"}
      </button>
      {message ? <p className={message.includes("failed") ? "danger-text" : "success-text"}>{message}</p> : null}
    </form>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
