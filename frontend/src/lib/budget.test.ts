import { describe, expect, it } from "vitest";
import { budgetTone, categoryValue, monthBounds, parseCategoryValue } from "./budget";

describe("budgetTone", () => {
  it("warns from 80% and only flags overspending past 100%", () => {
    expect(budgetTone(79.9)).toBe("good");
    expect(budgetTone(80)).toBe("warn");
    expect(budgetTone(100)).toBe("warn");
    expect(budgetTone(100.1)).toBe("over");
    expect(budgetTone(250)).toBe("over");
  });
});

describe("monthBounds", () => {
  it("returns the first and last day, including leap Februaries", () => {
    expect(monthBounds(2026, 9)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthBounds(2028, 1)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});

describe("category select values", () => {
  it("round-trips categories, uncategorized and transfers", () => {
    expect(categoryValue(7, false)).toBe("7");
    expect(categoryValue(null, false)).toBe("");
    expect(categoryValue(7, true)).toBe("transfer");

    expect(parseCategoryValue("7")).toEqual({ category_id: 7, is_transfer: false });
    expect(parseCategoryValue("")).toEqual({ category_id: null, is_transfer: false });
    expect(parseCategoryValue("transfer")).toEqual({ category_id: null, is_transfer: true });
  });
});
