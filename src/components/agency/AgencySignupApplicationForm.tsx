"use client";

import { useEffect, useState } from "react";

const countries = [
  "MY - Malaysia",
  "TH - Thailand",
  "VN - Vietnam",
  "ID - Indonesia",
  "PH - Philippines",
  "SG - Singapore",
  "JP - Japan",
  "CN - China",
  "TW - Taiwan",
  "HK - Hong Kong",
  "IN - India",
  "AE - United Arab Emirates",
  "EG - Egypt",
  "US - United States",
  "AU - Australia"
];

export function AgencySignupApplicationForm() {
  const [countryOptions, setCountryOptions] = useState<string[]>(countries);
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/countries")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!mounted || !payload?.data?.length) return;
        setCountryOptions(
          payload.data.map((country: { countryCode: string; countryName: string }) => `${country.countryCode} - ${country.countryName}`)
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      companyName: String(formData.get("companyName") ?? "").trim(),
      contactName: String(formData.get("contactName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      country: String(formData.get("country") ?? "").trim(),
      website: String(formData.get("website") ?? "").trim(),
      notes: String(formData.get("notes") ?? "").trim()
    };

    const response = await fetch("/api/agency/signup-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    setIsBusy(false);
    if (!response.ok) {
      setMessage(result.error ?? "Application failed");
      return;
    }
    setMessage(`Application submitted. Reference: ${result.data.id}`);
  }

  return (
    <form action={submit} className="panel-section stacked-form">
      <div className="section-heading">
        <div>
          <h2>Partner Sign-up Application</h2>
          <p>JHT admin will review and approve the mother account before portal access is activated.</p>
        </div>
        <span>Approval required</span>
      </div>
      <div className="form-grid two-column">
        <label>
          Partner Company Name
          <input disabled={isBusy} name="companyName" required />
        </label>
        <label>
          Contact Person
          <input disabled={isBusy} name="contactName" />
        </label>
        <label>
          Phone
          <input disabled={isBusy} name="phone" />
        </label>
        <label>
          Email
          <input disabled={isBusy} name="email" required type="email" />
        </label>
        <label>
          Country
          <input disabled={isBusy} list="agency-country-options" name="country" placeholder="Search country" required />
          <datalist id="agency-country-options">
            {countryOptions.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
        </label>
        <label>
          Website
          <input disabled={isBusy} name="website" placeholder="https://..." />
        </label>
      </div>
      <label>
        Notes
        <textarea disabled={isBusy} name="notes" placeholder="Business type, expected Korea groups, contact notes" rows={3} />
      </label>
      <div className="inline-actions">
        <button disabled={isBusy} type="submit">
          Submit Application
        </button>
        {message ? <span>{message}</span> : null}
      </div>
    </form>
  );
}
