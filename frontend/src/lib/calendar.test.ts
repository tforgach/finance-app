import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "../types";
import { buildMonthGrid, groupByDate, monthKey, shiftMonth, summarize } from "./calendar";

const entry = (overrides: Partial<CalendarEntry>): CalendarEntry => ({
  bill_id: 1,
  name: "Rent",
  amount: "100.00",
  due_date: "2026-10-01",
  autopay: false,
  status: "upcoming",
  ...overrides,
});

describe("buildMonthGrid", () => {
  it("pads a month that starts mid-week with the previous month", () => {
    const weeks = buildMonthGrid(2026, 9); // October 2026 starts on a Thursday
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ iso: "2026-09-27", day: 27, inMonth: false });
    expect(weeks[0][4]).toEqual({ iso: "2026-10-01", day: 1, inMonth: true });
  });

  it("uses exactly four weeks when February starts on a Sunday", () => {
    const weeks = buildMonthGrid(2026, 1);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0].iso).toBe("2026-02-01");
    expect(weeks.flat().every((cell) => cell.inMonth)).toBe(true);
  });
});

describe("shiftMonth / monthKey", () => {
  it("wraps across year boundaries", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month0: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month0: 11 });
  });

  it("formats the API month parameter", () => {
    expect(monthKey(2026, 2)).toBe("2026-03");
  });
});

describe("groupByDate / summarize", () => {
  const entries = [
    entry({ bill_id: 1, amount: "100.00", status: "paid" }),
    entry({ bill_id: 2, amount: "50.50", status: "overdue", due_date: "2026-10-01" }),
    entry({ bill_id: 3, amount: "25.00", status: "upcoming", due_date: "2026-10-15" }),
  ];

  it("groups entries by due date", () => {
    const grouped = groupByDate(entries);
    expect(grouped["2026-10-01"]).toHaveLength(2);
    expect(grouped["2026-10-15"]).toHaveLength(1);
  });

  it("totals paid, outstanding and overdue", () => {
    expect(summarize(entries)).toEqual({
      total: 175.5,
      paid: 100,
      outstanding: 75.5,
      overdueCount: 1,
    });
  });
});
