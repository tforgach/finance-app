import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import {
  buildMonthGrid,
  groupByDate,
  monthKey,
  shiftMonth,
  summarize,
  toISO,
} from "../lib/calendar";
import { formatDay, formatMoney } from "../lib/format";
import type { CalendarEntry } from "../types";
import { AddBillForm } from "./AddBillForm";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function BillsCalendar({ initialDate }: { initialDate?: Date }) {
  const [view, setView] = useState(() => {
    const start = initialDate ?? new Date();
    return { year: start.getFullYear(), month0: start.getMonth() };
  });
  const [todayISO] = useState(() => toISO(new Date()));
  const queryClient = useQueryClient();
  const key = monthKey(view.year, view.month0);

  const calendar = useQuery({ queryKey: ["calendar", key], queryFn: () => api.calendar(key) });
  const upcoming = useQuery({ queryKey: ["upcoming"], queryFn: () => api.upcoming(14) });

  const toggle = useMutation({
    mutationFn: (entry: CalendarEntry) =>
      entry.status === "paid"
        ? api.markUnpaid(entry.bill_id, entry.due_date)
        : api.markPaid(entry.bill_id, entry.due_date),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  const entries = calendar.data ?? [];
  const byDate = groupByDate(entries);
  const totals = summarize(entries);
  const title = new Date(view.year, view.month0, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const needsAttention = upcoming.data ?? [];

  return (
    <div className="bills">
      <div className="bills-main">
        <div className="toolbar">
          <h2>{title}</h2>
          <div className="toolbar-buttons">
            <button onClick={() => setView((v) => shiftMonth(v.year, v.month0, -1))}>
              ← Prev
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setView({ year: now.getFullYear(), month0: now.getMonth() });
              }}
            >
              Today
            </button>
            <button onClick={() => setView((v) => shiftMonth(v.year, v.month0, 1))}>
              Next →
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="card stat">
            <span>Total due</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
          <div className="card stat">
            <span>Paid</span>
            <strong>{formatMoney(totals.paid)}</strong>
          </div>
          <div className="card stat">
            <span>Still to pay</span>
            <strong>{formatMoney(totals.outstanding)}</strong>
          </div>
          <div className={`card stat ${totals.overdueCount ? "stat-alert" : ""}`}>
            <span>Overdue</span>
            <strong>{totals.overdueCount}</strong>
          </div>
        </div>

        {calendar.isError && (
          <p className="error">Can't reach the API. Is the backend running on port 8000?</p>
        )}

        <div className="grid" role="grid" aria-label={`Bills for ${title}`}>
          {WEEKDAYS.map((day) => (
            <div key={day} className="weekday">
              {day}
            </div>
          ))}
          {buildMonthGrid(view.year, view.month0)
            .flat()
            .map((cell) => (
              <div
                key={cell.iso}
                className={`cell ${cell.inMonth ? "" : "cell-outside"} ${
                  cell.iso === todayISO ? "cell-today" : ""
                }`}
              >
                <span className="day-number">{cell.day}</span>
                {(byDate[cell.iso] ?? []).map((entry) => (
                  <button
                    key={`${entry.bill_id}-${entry.due_date}`}
                    className={`chip chip-${entry.status}`}
                    onClick={() => toggle.mutate(entry)}
                    aria-label={`${entry.name} ${formatMoney(entry.amount)} due ${formatDay(
                      entry.due_date,
                    )}, ${entry.status}. Click to mark ${
                      entry.status === "paid" ? "unpaid" : "paid"
                    }`}
                  >
                    <span className="chip-name">
                      {entry.autopay ? "↻ " : ""}
                      {entry.name}
                    </span>
                    <span className="chip-amount">{formatMoney(entry.amount)}</span>
                  </button>
                ))}
              </div>
            ))}
        </div>
        <p className="legend">
          <span className="chip chip-upcoming">Upcoming</span>
          <span className="chip chip-overdue">Overdue</span>
          <span className="chip chip-paid">Paid</span>
          <span>↻ autopay · click a bill to toggle paid</span>
        </p>
      </div>

      <aside className="bills-side">
        <div className="card">
          <h2>Needs attention</h2>
          {needsAttention.length === 0 ? (
            <p className="muted">Nothing overdue or due in the next 14 days.</p>
          ) : (
            <ul className="attention">
              {needsAttention.map((entry) => (
                <li key={`${entry.bill_id}-${entry.due_date}`} className={`att-${entry.status}`}>
                  <div>
                    <strong>{entry.name}</strong>
                    <span>
                      {entry.status === "overdue" ? "Overdue since " : "Due "}
                      {formatDay(entry.due_date)}
                    </span>
                  </div>
                  <div className="att-right">
                    <strong>{formatMoney(entry.amount)}</strong>
                    <button onClick={() => toggle.mutate(entry)}>Mark paid</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <AddBillForm />
      </aside>
    </div>
  );
}
