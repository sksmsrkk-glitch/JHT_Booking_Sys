"use client";

import { useState } from "react";
import {
  SUPPLIER_MESSAGE_CHANNELS,
  SUPPLIER_MESSAGE_TYPES
} from "@/features/supplier-comms/queries";
import type { ReservationListItem, ReservationSupplierOption } from "@/features/reservation/types";
import type { SupplierListItem } from "@/features/supplier/types";
import { buildDefaultSupplierMessageTemplate } from "@/lib/domain/supplier-messages.mjs";

export function SupplierMessageDraftForm({
  disabledReason,
  reservationId,
  reservations = [],
  suppliers = [],
  supplierOptions = [],
  reservationContext
}: {
  disabledReason?: string;
  reservationId?: string;
  reservations?: ReservationListItem[];
  suppliers?: SupplierListItem[];
  supplierOptions?: ReservationSupplierOption[];
  reservationContext?: {
    code: string;
    tourName: string | null;
    startDate: string | null;
    endDate: string | null;
    agencyName: string | null;
  };
}) {
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [selectedReservationId, setSelectedReservationId] = useState(reservationId ?? "");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [messageType, setMessageType] = useState("booking_request");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const availableSuppliers = supplierOptions.length > 0
    ? supplierOptions
    : suppliers.map((supplier) => ({ id: supplier.id, nameKo: supplier.nameKo, contacts: [] }));
  const selectedSupplier = availableSuppliers.find((option) => option.id === selectedSupplierId);
  const availableContacts = selectedSupplier?.contacts ?? [];
  const resolvedReservation = resolveReservationContext();
  const formDisabledReason =
    disabledReason ??
    (!reservationId && reservations.length === 0
      ? "Create or load a reservation before drafting supplier messages."
      : availableSuppliers.length === 0
        ? "Add at least one domestic supplier before drafting supplier messages."
        : undefined);
  const isDisabled = Boolean(formDisabledReason);

  async function createDraft(formData: FormData) {
    setIsBusy(true);
    setMessage("");
    const payload = {
      reservationId: String(formData.get("reservationId") ?? "").trim(),
      domesticSupplierId: String(formData.get("domesticSupplierId") ?? "").trim(),
      supplierContactId: normalizeOptionalString(formData.get("supplierContactId")),
      messageType: String(formData.get("messageType") ?? ""),
      channel: String(formData.get("channel") ?? ""),
      subjectTemplate: String(formData.get("subjectTemplate") ?? ""),
      body: String(formData.get("body") ?? ""),
      revisionNo: Number(formData.get("revisionNo") ?? 1),
      data: buildTemplateData(selectedSupplierId)
    };

    const response = await fetch("/api/supplier-messages/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Draft creation failed");
      setIsBusy(false);
      return;
    }
    window.location.reload();
  }

  function fillTemplate() {
    const template = buildDefaultSupplierMessageTemplate({
      messageType,
      data: buildTemplateData(selectedSupplierId)
    });
    setSubjectTemplate(template.subject);
    setBodyTemplate(template.body);
  }

  function buildTemplateData(supplierId: string) {
    const supplier = availableSuppliers.find((option) => option.id === supplierId);
    return {
      reservation: {
        code: resolvedReservation?.code,
        tourName: resolvedReservation?.tourName,
        startDate: resolvedReservation?.startDate,
        endDate: resolvedReservation?.endDate
      },
      agency: {
        name: resolvedReservation?.agencyName
      },
      supplier: {
        name: supplier?.nameKo
      },
      message: {}
    };
  }

  function resolveReservationContext() {
    if (reservationContext) return reservationContext;
    const reservation = reservations.find((option) => option.id === selectedReservationId);
    if (!reservation) return null;
    return {
      code: reservation.reservationCode,
      tourName: reservation.tourName,
      startDate: reservation.tourStartDate,
      endDate: reservation.tourEndDate,
      agencyName: reservation.agencyName
    };
  }

  return (
    <form action={createDraft} className="stacked-form">
      {formDisabledReason ? <p className="warning-text">{formDisabledReason}</p> : null}
      <div className="form-grid two-column">
        <label>
          Reservation
          {reservationId ? (
            <>
              <input name="reservationId" type="hidden" value={reservationId} />
              <input
                disabled
                readOnly
                value={formatReservationContext(resolvedReservation) ?? "Selected reservation"}
              />
            </>
          ) : reservations.length > 0 ? (
            <select
              disabled={isDisabled}
              name="reservationId"
              onChange={(event) => setSelectedReservationId(event.target.value)}
              required
              value={selectedReservationId}
            >
              <option value="">Select reservation</option>
              {reservations.map((reservation) => (
                <option key={reservation.id} value={reservation.id}>
                  {formatReservationOption(reservation)}
                </option>
              ))}
            </select>
          ) : (
            <select disabled name="reservationId" required>
              <option value="">No reservations available</option>
            </select>
          )}
        </label>
        <label>
          Domestic Supplier
          {availableSuppliers.length > 0 ? (
            <select
              disabled={isDisabled}
              name="domesticSupplierId"
              onChange={(event) => setSelectedSupplierId(event.target.value)}
              required
              value={selectedSupplierId}
            >
              <option value="">Select supplier</option>
              {availableSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.nameKo}
                </option>
              ))}
            </select>
          ) : (
            <select disabled name="domesticSupplierId" required>
              <option value="">No suppliers available</option>
            </select>
          )}
        </label>
        <label>
          Supplier Contact
          {availableContacts.length > 0 ? (
            <select disabled={isDisabled} name="supplierContactId">
              <option value="">No specific contact</option>
              {availableContacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                  {contact.email ? ` (${contact.email})` : ""}
                </option>
              ))}
            </select>
          ) : (
            <select disabled name="supplierContactId">
              <option value="">No active booking contact</option>
            </select>
          )}
        </label>
        <label>
          Revision No.
          <input defaultValue="1" disabled={isDisabled} min="1" name="revisionNo" type="number" />
        </label>
        <label>
          Message Type
          <select disabled={isDisabled} name="messageType" onChange={(event) => setMessageType(event.target.value)} value={messageType}>
            {SUPPLIER_MESSAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Channel
          <select defaultValue="email" disabled={isDisabled} name="channel">
            {SUPPLIER_MESSAGE_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {formatLabel(channel)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="full-width-field">
        Subject
        <input
          name="subjectTemplate"
          disabled={isDisabled}
          onChange={(event) => setSubjectTemplate(event.target.value)}
          placeholder="Supplier booking request"
          value={subjectTemplate}
        />
      </label>
      <label className="full-width-field">
        Body
        <textarea
          name="body"
          disabled={isDisabled}
          onChange={(event) => setBodyTemplate(event.target.value)}
          placeholder="Message body for the supplier"
          required
          rows={7}
          value={bodyTemplate}
        />
      </label>
      <div className="inline-actions">
        <button className="button-secondary" disabled={isBusy || isDisabled} onClick={fillTemplate} type="button">
          Generate Template
        </button>
        <button className="button-primary" disabled={isBusy || isDisabled} type="submit">
          Create Draft
        </button>
        {message ? <span className="danger-text">{message}</span> : null}
      </div>
    </form>
  );
}

function normalizeOptionalString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatReservationOption(reservation: ReservationListItem) {
  const tour = reservation.tourName ? ` - ${reservation.tourName}` : "";
  const agency = reservation.agencyName ? ` (${reservation.agencyName})` : "";
  return `${reservation.reservationCode}${tour}${agency}`;
}

function formatReservationContext(
  reservation: {
    code: string;
    tourName: string | null;
    startDate: string | null;
    endDate: string | null;
    agencyName: string | null;
  } | null
) {
  if (!reservation) return null;
  const tour = reservation.tourName ? ` - ${reservation.tourName}` : "";
  const dates = reservation.startDate || reservation.endDate ? ` (${formatDateRange(reservation.startDate, reservation.endDate)})` : "";
  return `${reservation.code}${tour}${dates}`;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`;
  if (startDate) return `from ${startDate}`;
  if (endDate) return `until ${endDate}`;
  return "";
}
