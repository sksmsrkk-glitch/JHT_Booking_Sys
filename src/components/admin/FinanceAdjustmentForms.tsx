"use client";

import { safeFetch } from "@/lib/client/safe-fetch";

import { requestRouteRefresh } from "@/lib/client/route-refresh";

import { useState } from "react";
import type { ReservationListItem } from "@/features/reservation/types";
import type { SupplierListItem } from "@/features/supplier/types";

export function FinanceAdjustmentForms({
  reservations,
  suppliers
}: {
  reservations: ReservationListItem[];
  suppliers: SupplierListItem[];
}) {
  return (
    <section className="panel-section">
      <div className="section-heading">
        <h2>Reservation Finance Adjustments</h2>
        <span>Finance only</span>
      </div>
      <div className="finance-action-grid">
        <AdjustmentForm
          amountName="amount"
          endpoint="/api/finance/expenses"
          fields={[
            { name: "category", label: "Category", placeholder: "hotel, guide, vehicle", required: true },
            { name: "description", label: "Description", placeholder: "Supplier payment detail", required: true },
            { name: "expenseDate", label: "Expense Date", type: "date" }
          ]}
          reservations={reservations}
          showSupplierSelect
          submitLabel="Add Expense"
          suppliers={suppliers}
          title="Expense"
        />
        <AdjustmentForm
          amountName="amount"
          endpoint="/api/finance/extra-revenues"
          fields={[
            { name: "revenueType", label: "Revenue Type", placeholder: "upgrade, fee, add-on", required: true },
            { name: "description", label: "Description", placeholder: "Optional note" }
          ]}
          reservations={reservations}
          submitLabel="Add Revenue"
          suppliers={suppliers}
          title="Extra Revenue"
        />
        <AdjustmentForm
          amountName="commissionAmount"
          endpoint="/api/finance/shopping-commissions"
          fields={[
            { name: "shopName", label: "Shop Name", placeholder: "Shop or venue name", required: true },
            { name: "visitDate", label: "Visit Date", type: "date" },
            { name: "salesAmount", label: "Sales Amount", type: "number" }
          ]}
          reservations={reservations}
          showSupplierSelect
          submitLabel="Add Commission"
          suppliers={suppliers}
          title="Shopping Commission"
        />
        <RecalculateSettlementForm reservations={reservations} />
      </div>
    </section>
  );
}

function AdjustmentForm({
  amountName,
  endpoint,
  fields,
  reservations,
  showSupplierSelect = false,
  submitLabel,
  suppliers,
  title
}: {
  amountName: string;
  endpoint: string;
  fields: Array<{ name: string; label: string; placeholder?: string; required?: boolean; type?: string }>;
  reservations: ReservationListItem[];
  showSupplierSelect?: boolean;
  submitLabel: string;
  suppliers: SupplierListItem[];
  title: string;
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload: Record<string, unknown> = {
      reservationId: String(formData.get("reservationId") ?? "").trim(),
      currency: String(formData.get("currency") ?? "KRW").trim() || "KRW",
      [amountName]: Number(formData.get(amountName) ?? 0)
    };

    for (const field of fields) {
      payload[field.name] = String(formData.get(field.name) ?? "").trim();
    }

    const response = await safeFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Save failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={submit} className="compact-form">
      <h3>{title}</h3>
      <ReservationSelect reservations={reservations} />
      <label>
        Currency
        <input defaultValue="KRW" name="currency" />
      </label>
      <label>
        Amount
        <input min="0" name={amountName} required step="0.01" type="number" />
      </label>
      {fields.map((field) => (
        <label key={field.name}>
          {field.label}
          <input name={field.name} placeholder={field.placeholder} required={field.required} type={field.type ?? "text"} />
        </label>
      ))}
      {showSupplierSelect ? <SupplierSelect suppliers={suppliers} /> : null}
      <button className="button-secondary" disabled={isBusy} type="submit">
        {submitLabel}
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </form>
  );
}

function SupplierSelect({ suppliers }: { suppliers: SupplierListItem[] }) {
  return (
    <label>
      Supplier
      <select name="domesticSupplierId">
        <option value="">Not linked</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.nameKo} ({formatLabel(supplier.category)})
          </option>
        ))}
      </select>
    </label>
  );
}

function RecalculateSettlementForm({ reservations }: { reservations: ReservationListItem[] }) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const response = await safeFetch("/api/finance/settlements/recalculate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reservationId: String(formData.get("reservationId") ?? "").trim() })
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Recalculate failed");
      setIsBusy(false);
      return;
    }
    requestRouteRefresh();
  }

  return (
    <form action={submit} className="compact-form">
      <h3>Settlement</h3>
      <ReservationSelect reservations={reservations} />
      <button className="button-primary" disabled={isBusy} type="submit">
        Recalculate
      </button>
      {message ? <span className="danger-text">{message}</span> : null}
    </form>
  );
}

function ReservationSelect({ reservations }: { reservations: ReservationListItem[] }) {
  return (
    <label>
      Reservation
      <select name="reservationId" required>
        <option value="">Select reservation</option>
        {reservations.map((reservation) => (
          <option key={reservation.id} value={reservation.id}>
            {formatReservationOption(reservation)}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatReservationOption(reservation: ReservationListItem) {
  const tour = reservation.tourName ? ` - ${reservation.tourName}` : "";
  const agency = reservation.agencyName ? ` (${reservation.agencyName})` : "";
  return `${reservation.reservationCode}${tour}${agency}`;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
