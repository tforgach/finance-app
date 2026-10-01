import type { CalendarEntry } from "../types";

export interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthKey(year: number, month0: number): string {
  return `${year}-${pad(month0 + 1)}`;
}

export function shiftMonth(year: number, month0: number, delta: number) {
  const date = new Date(year, month0 + delta, 1);
  return { year: date.getFullYear(), month0: date.getMonth() };
}

/** Weeks (Sunday-first) covering the month, padded with neighbouring-month days. */
export function buildMonthGrid(year: number, month0: number): Cell[][] {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const weekCount = Math.ceil((first.getDay() + daysInMonth) / 7);

  const weeks: Cell[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(year, month0, 1 - first.getDay() + w * 7 + d);
      week.push({
        iso: toISO(date),
        day: date.getDate(),
        inMonth: date.getMonth() === month0,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export function groupByDate(entries: CalendarEntry[]): Record<string, CalendarEntry[]> {
  const grouped: Record<string, CalendarEntry[]> = {};
  for (const entry of entries) (grouped[entry.due_date] ??= []).push(entry);
  return grouped;
}

export function summarize(entries: CalendarEntry[]) {
  let total = 0;
  let paid = 0;
  let overdueCount = 0;
  for (const entry of entries) {
    const amount = Number(entry.amount);
    total += amount;
    if (entry.status === "paid") paid += amount;
    if (entry.status === "overdue") overdueCount += 1;
  }
  return { total, paid, outstanding: total - paid, overdueCount };
}
