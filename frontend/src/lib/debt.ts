export function formatMonths(months: number | null): string {
  if (months === null) return "Never";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} mo`;
  if (rest === 0) return `${years} yr`;
  return `${years} yr ${rest} mo`;
}

export function monthYearAfter(from: Date, months: number): string {
  const date = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export type UtilizationTone = "good" | "fair" | "high";

export function utilizationTone(percent: number): UtilizationTone {
  if (percent < 30) return "good";
  if (percent < 70) return "fair";
  return "high";
}

/** Normalises free-form input to a non-negative amount string the API accepts. */
export function cleanExtra(raw: string): string {
  const value = Number(raw);
  return raw.trim() === "" || !Number.isFinite(value) || value < 0 ? "0" : String(value);
}
