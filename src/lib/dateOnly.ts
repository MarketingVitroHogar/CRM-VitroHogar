import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Helpers for the app's "date-only" fields (fecha de ingreso, próximo
 * seguimiento, fecha de cierre). These are always stored anchored to UTC
 * midnight for the intended calendar day (see leadSchemas.ts's date
 * transforms), regardless of which timezone the server or browser runs in.
 *
 * Never format or bucket these fields with plain local-timezone Date
 * getters/date-fns calls — a value stored as UTC midnight renders as the
 * previous day in any timezone behind UTC (e.g. Mexico, UTC-6), which is
 * exactly the bug these helpers exist to prevent. Always go through UTC
 * getters (or build a local Date from UTC-extracted Y/M/D, as below) instead.
 */

/** Formats a date-only value for display, immune to the viewer's local timezone. */
export function formatDateOnly(value: string | Date | null, pattern = "d MMM yyyy"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  // Build a local Date from the UTC calendar components, then format with
  // date-fns' local getters — self-consistent, so no shift occurs.
  const local = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return format(local, pattern, { locale: es });
}

/** "YYYY-MM" bucket key for a date-only value, using its UTC calendar date. */
export function monthKeyUTC(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** [start, end) UTC month range for a "YYYY-MM" key, matching how date-only fields are stored. */
export function monthRangeUTC(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)),
  };
}
