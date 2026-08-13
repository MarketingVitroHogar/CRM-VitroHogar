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

// All branches operate in Mexico Central Time. Mexico abolished nationwide
// DST in 2022, so this fixed offset holds year-round (revisit if the
// business ever opens a branch in a different timezone).
const MEXICO_UTC_OFFSET_HOURS = 6;

/**
 * "Today" in Mexico's calendar, expressed as a UTC-midnight-anchored Date so
 * it's directly comparable against date-only fields (fecha, proximoSeguimiento).
 *
 * Comparing those fields against a raw `new Date()` instant is wrong: UTC
 * runs 6h ahead of Mexico, so a proximoSeguimiento set for "today" (stored as
 * that day's UTC midnight) reads as already-past from ~6pm the previous day
 * in Mexico onward — every "due today" follow-up would falsely show overdue
 * for most of the day before it's actually due.
 */
export function mexicoTodayAsUTCDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() - MEXICO_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** UTC-midnight-anchored calendar date for a date-only field's own Y/M/D (drops any time-of-day noise). */
export function calendarDateUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** [start, end) UTC range for an inclusive "YYYY-MM-DD" from/to pair (e.g. a report date-range filter). */
export function dayRangeUTC(from: string, to: string): { start: Date; end: Date } {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return {
    start: new Date(Date.UTC(fy, fm - 1, fd)),
    end: new Date(Date.UTC(ty, tm - 1, td) + 86_400_000), // day after `to`, exclusive upper bound
  };
}
