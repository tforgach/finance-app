import { describe, expect, it } from "vitest";
import { cleanExtra, formatMonths, monthYearAfter, utilizationTone } from "./debt";

describe("formatMonths", () => {
  it("formats months, whole years and mixed durations", () => {
    expect(formatMonths(7)).toBe("7 mo");
    expect(formatMonths(24)).toBe("2 yr");
    expect(formatMonths(28)).toBe("2 yr 4 mo");
  });

  it("says Never when the debt is not paid off", () => {
    expect(formatMonths(null)).toBe("Never");
  });
});

describe("monthYearAfter", () => {
  it("rolls into the following year", () => {
    expect(monthYearAfter(new Date(2026, 9, 15), 5)).toBe("Mar 2027");
  });
});

describe("utilizationTone", () => {
  it("buckets utilization at 30% and 70%", () => {
    expect(utilizationTone(29.9)).toBe("good");
    expect(utilizationTone(30)).toBe("fair");
    expect(utilizationTone(69.9)).toBe("fair");
    expect(utilizationTone(70)).toBe("high");
  });
});

describe("cleanExtra", () => {
  it("falls back to 0 for blank, negative or invalid input", () => {
    expect(cleanExtra("")).toBe("0");
    expect(cleanExtra("-5")).toBe("0");
    expect(cleanExtra("abc")).toBe("0");
  });

  it("passes through valid amounts", () => {
    expect(cleanExtra("150")).toBe("150");
    expect(cleanExtra("12.5")).toBe("12.5");
  });
});
