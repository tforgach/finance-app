import { toISO } from "./calendar";

export type BudgetTone = "good" | "warn" | "over";

export function budgetTone(percentUsed: number): BudgetTone {
  if (percentUsed > 100) return "over";
  if (percentUsed >= 80) return "warn";
  return "good";
}

/** Inclusive first and last day of a month as ISO dates. */
export function monthBounds(year: number, month0: number) {
  return {
    start: toISO(new Date(year, month0, 1)),
    end: toISO(new Date(year, month0 + 1, 0)),
  };
}

export const TRANSFER_VALUE = "transfer";

export function categoryValue(categoryId: number | null, isTransfer: boolean): string {
  if (isTransfer) return TRANSFER_VALUE;
  return categoryId === null ? "" : String(categoryId);
}

export function parseCategoryValue(value: string): {
  category_id: number | null;
  is_transfer: boolean;
} {
  if (value === TRANSFER_VALUE) return { category_id: null, is_transfer: true };
  return { category_id: value === "" ? null : Number(value), is_transfer: false };
}
