/**
 * @file 한글 책임: `Final Operation Snapshot Form` UI 컴포넌트의 표시 상태와 사용자 상호작용을 담당합니다.
 * 화면 입력은 서버 권한 검사를 대체하지 않으며, 제출·실패·재시도 상태를 명확히 관리해 중복 요청과 멈춘 버튼을 방지합니다.
 */
"use client";

import { LocaleDateInput } from "@/components/LocaleDateInput";
import { safeFetch } from "@/lib/client/safe-fetch";

import { useRouter } from "next/navigation";
import { useState } from "react";

/*
 * 확정서 작성 화면입니다.
 *
 * 최종 견적서가 accepted 된 뒤, 내부 오퍼레이터가 실제 예약 기준으로
 * 호텔명/룸타입/식사/관광지/항공/계좌/특이사항을 확정합니다.
 * 이 화면에서 finalized + issueInvoice를 실행하면 인보이스 자동 발행 API로 이어집니다.
 */
type DayRow = {
  id: string;
  day: number;
  date: string;
  title: string;
  hotel: string;
  roomType: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  attractions: string;
  description: string;
  specialNotes: string;
};

type FlightRow = {
  id: string;
  type: string;
  flightNo: string;
  date: string;
  time: string;
  route: string;
};

export function FinalOperationSnapshotForm({
  reservationId,
  disabledReason,
  previewMode = false
}: {
  reservationId: string;
  disabledReason?: string;
  previewMode?: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState<DayRow[]>(defaultDays);
  const [flights, setFlights] = useState<FlightRow[]>(defaultFlights);
  const [bank, setBank] = useState(defaultBank);
  const [operatorNotes, setOperatorNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(status: "draft" | "finalized", issueInvoice: boolean) {
    setIsBusy(true);
    setMessage("");

    // 표 형태 입력값을 DB에 저장할 JSON 스냅샷으로 변환합니다.
    // 예전 JSON textarea를 업무자가 직접 수정하던 방식보다 실수를 줄이기 위한 구조입니다.
    const daySnapshots = days.map((day) => ({
      day: day.day,
      date: emptyToNull(day.date),
      title: day.title,
      hotel: day.hotel,
      roomType: day.roomType,
      meals: {
        breakfast: emptyToNull(day.breakfast),
        lunch: emptyToNull(day.lunch),
        dinner: emptyToNull(day.dinner)
      },
      attractions: splitList(day.attractions),
      description: day.description,
      specialNotes: day.specialNotes
    }));

    if (previewMode) {
      setMessage(issueInvoice ? "Preview confirmation finalized. Invoice generation is simulated in preview mode." : "Preview draft saved.");
      setIsBusy(false);
      return;
    }

    const response = await safeFetch(`/api/reservations/${reservationId}/final-operation-snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status,
        issueInvoice,
        daySnapshots,
        hotelSnapshot: days.map((day) => ({
          day: day.day,
          hotel: day.hotel,
          roomType: day.roomType
        })),
        mealSnapshot: days.map((day) => ({
          day: day.day,
          meals: {
            breakfast: emptyToNull(day.breakfast),
            lunch: emptyToNull(day.lunch),
            dinner: emptyToNull(day.dinner)
          }
        })),
        flightDetails: flights.map((flight) => ({
          type: flight.type,
          flightNo: flight.flightNo,
          date: emptyToNull(flight.date),
          time: emptyToNull(flight.time),
          route: flight.route
        })),
        bankAccountSnapshot: bank,
        operatorNotes
      })
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Final operation snapshot save failed");
      setIsBusy(false);
      return;
    }

    const invoiceId = result.data?.invoice?.id;
    if (invoiceId) {
      // 인보이스가 자동 생성된 경우 회계 담당자가 바로 확인할 수 있도록 상세 화면으로 이동합니다.
      router.push(`/admin/finance/invoices/${invoiceId}`);
      return;
    }
    setMessage(status === "finalized" ? "Final snapshot saved." : "Draft saved.");
    setIsBusy(false);
  }

  return (
    <div className="stacked-form">
      <section className="table-shell nested" aria-label="Final day schedule">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th>Title</th>
              <th>Hotel / Room</th>
              <th>Meals</th>
              <th>Attractions</th>
              <th>Description / Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day.id}>
                <td>
                  <input
                    aria-label="Day"
                    min="1"
                    type="number"
                    value={day.day}
                    onChange={(event) => updateDay(index, { day: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <LocaleDateInput
                    aria-label="Date"
                    value={day.date}
                    onChange={(event) => updateDay(index, { date: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label="Title"
                    value={day.title}
                    onChange={(event) => updateDay(index, { title: event.target.value })}
                  />
                </td>
                <td>
                  <div className="field-stack">
                    <input
                      aria-label="Hotel"
                      placeholder="Hotel name"
                      value={day.hotel}
                      onChange={(event) => updateDay(index, { hotel: event.target.value })}
                    />
                    <input
                      aria-label="Room type"
                      placeholder="Twin, Double, Suite"
                      value={day.roomType}
                      onChange={(event) => updateDay(index, { roomType: event.target.value })}
                    />
                  </div>
                </td>
                <td>
                  <div className="field-stack">
                    <input
                      aria-label="Breakfast"
                      placeholder="Breakfast"
                      value={day.breakfast}
                      onChange={(event) => updateDay(index, { breakfast: event.target.value })}
                    />
                    <input
                      aria-label="Lunch"
                      placeholder="Lunch"
                      value={day.lunch}
                      onChange={(event) => updateDay(index, { lunch: event.target.value })}
                    />
                    <input
                      aria-label="Dinner"
                      placeholder="Dinner"
                      value={day.dinner}
                      onChange={(event) => updateDay(index, { dinner: event.target.value })}
                    />
                  </div>
                </td>
                <td>
                  <textarea
                    aria-label="Attractions"
                    placeholder="Separate with commas"
                    rows={4}
                    value={day.attractions}
                    onChange={(event) => updateDay(index, { attractions: event.target.value })}
                  />
                </td>
                <td>
                  <div className="field-stack">
                    <textarea
                      aria-label="Description"
                      placeholder="Final day description"
                      rows={3}
                      value={day.description}
                      onChange={(event) => updateDay(index, { description: event.target.value })}
                    />
                    <textarea
                      aria-label="Special notes"
                      placeholder="Dietary, late check-in, luggage, etc."
                      rows={2}
                      value={day.specialNotes}
                      onChange={(event) => updateDay(index, { specialNotes: event.target.value })}
                    />
                  </div>
                </td>
                <td>
                  <button
                    className="button-secondary compact-button"
                    disabled={days.length <= 1}
                    onClick={() => removeDay(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button className="button-secondary" onClick={addDay} type="button">
        Add Day
      </button>

      <section className="table-shell nested" aria-label="Flight details">
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Flight No</th>
              <th>Date</th>
              <th>Time</th>
              <th>Route</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {flights.map((flight, index) => (
              <tr key={flight.id}>
                <td>
                  <select value={flight.type} onChange={(event) => updateFlight(index, { type: event.target.value })}>
                    <option value="Arrival">Arrival</option>
                    <option value="Departure">Departure</option>
                    <option value="Domestic">Domestic</option>
                  </select>
                </td>
                <td>
                  <input value={flight.flightNo} onChange={(event) => updateFlight(index, { flightNo: event.target.value })} />
                </td>
                <td>
                  <LocaleDateInput value={flight.date} onChange={(event) => updateFlight(index, { date: event.target.value })} />
                </td>
                <td>
                  <input type="time" value={flight.time} onChange={(event) => updateFlight(index, { time: event.target.value })} />
                </td>
                <td>
                  <input value={flight.route} onChange={(event) => updateFlight(index, { route: event.target.value })} />
                </td>
                <td>
                  <button
                    className="button-secondary compact-button"
                    disabled={flights.length <= 1}
                    onClick={() => removeFlight(index)}
                    type="button"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <button className="button-secondary" onClick={addFlight} type="button">
        Add Flight
      </button>

      <div className="form-grid two-column">
        <label>
          Payable To
          <input value={bank.payableTo} onChange={(event) => setBank({ ...bank, payableTo: event.target.value })} />
        </label>
        <label>
          Bank Name
          <input value={bank.bankName} onChange={(event) => setBank({ ...bank, bankName: event.target.value })} />
        </label>
        <label>
          Account No
          <input value={bank.accountNo} onChange={(event) => setBank({ ...bank, accountNo: event.target.value })} />
        </label>
        <label>
          Swift Code
          <input value={bank.swiftCode} onChange={(event) => setBank({ ...bank, swiftCode: event.target.value })} />
        </label>
      </div>

      <label>
        Operator Notes
        <textarea
          value={operatorNotes}
          onChange={(event) => setOperatorNotes(event.target.value)}
          placeholder="Final hotel deadline, menu exceptions, dietary notes, luggage truck notes"
          rows={4}
        />
      </label>

      <div className="inline-actions">
        <button className="button-secondary" disabled={isBusy || Boolean(disabledReason)} onClick={() => submit("draft", false)} type="button">
          Save Draft
        </button>
        <button className="button-primary" disabled={isBusy || Boolean(disabledReason)} onClick={() => submit("finalized", true)} type="button">
          Finalize & Issue Invoice
        </button>
        {disabledReason ? <span className="warning-text">{disabledReason}</span> : null}
        {message ? <span className={message.includes("failed") ? "danger-text" : "success-text"}>{message}</span> : null}
      </div>
    </div>
  );

  function updateDay(index: number, patch: Partial<DayRow>) {
    // Day별 호텔/식사/관광지 변경은 인보이스 일정에도 반영되는 최종 운영 정보입니다.
    setDays((current) => current.map((day, dayIndex) => (dayIndex === index ? { ...day, ...patch } : day)));
  }

  function addDay() {
    setDays((current) => [...current, makeDay(current.length + 1)]);
  }

  function removeDay(index: number) {
    setDays((current) => current.filter((_, dayIndex) => dayIndex !== index));
  }

  function updateFlight(index: number, patch: Partial<FlightRow>) {
    setFlights((current) => current.map((flight, flightIndex) => (flightIndex === index ? { ...flight, ...patch } : flight)));
  }

  function addFlight() {
    setFlights((current) => [...current, makeFlight(current.length + 1)]);
  }

  function removeFlight(index: number) {
    setFlights((current) => current.filter((_, flightIndex) => flightIndex !== index));
  }
}

function makeDay(day: number): DayRow {
  return {
    id: `day-${Date.now()}-${day}`,
    day,
    date: "",
    title: "",
    hotel: "",
    roomType: "",
    breakfast: "",
    lunch: "",
    dinner: "",
    attractions: "",
    description: "",
    specialNotes: ""
  };
}

function makeFlight(index: number): FlightRow {
  return {
    id: `flight-${Date.now()}-${index}`,
    type: index === 1 ? "Arrival" : "Departure",
    flightNo: "",
    date: "",
    time: "",
    route: ""
  };
}

function splitList(value: string) {
  // 관광지/체험 항목은 콤마, 세미콜론, 줄바꿈으로 빠르게 입력할 수 있게 분리합니다.
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function emptyToNull(value: string) {
  const text = value.trim();
  return text.length > 0 ? text : null;
}

const defaultDays: DayRow[] = [
  {
    id: "day-1",
    day: 1,
    date: "2026-03-24",
    title: "Arrival Seoul",
    hotel: "Confirmed hotel name",
    roomType: "Twin",
    breakfast: "",
    lunch: "",
    dinner: "Confirmed dinner menu",
    attractions: "Airport meet and greet, City orientation",
    description: "Final operator-confirmed schedule",
    specialNotes: "Late check-in or dietary notes"
  }
];

const defaultFlights: FlightRow[] = [
  { id: "flight-arrival", type: "Arrival", flightNo: "TBA", date: "2026-03-24", time: "", route: "TBA-ICN" }
];

const defaultBank = {
  payableTo: "JUNGHOTRAVEL CO., LTD.",
  bankName: "Woori Bank",
  accountNo: "TBA",
  swiftCode: "HVBKKRSE"
};
