/**
 * The single definition of a "valid date" used across the domain, shared by the
 * parse helpers and the date formatter (both depend on this module, not on each
 * other).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

/**
 * Strict ISO 8601 with a mandatory zone: date + 'T' + time, optional fractional
 * seconds, and either 'Z' or a ±hh:mm offset. The shape is matched with a regex;
 * the calendar validity is then checked by components, because a regex (and
 * Date.parse) would accept impossible dates like 2026-02-30 and silently roll
 * them over to 2 March.
 */
const ISO_SHAPE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Last day of a given month (1-12), accounting for leap years. */
function lastDayOfMonth(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return daysPerMonth[month - 1];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * True when `value` is a strict ISO 8601 date-time with zone AND a real calendar
 * date and time (month 1-12, day within the month incl. leap years, hour 0-23,
 * minute/second 0-59).
 */
export function isValidIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const m = ISO_SHAPE.exec(value);
  if (!m) {
    return false;
  }
  const [, y, mo, d, h, min, s] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(min);
  const second = Number(s);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > lastDayOfMonth(year, month)) return false;
  if (hour > 23) return false;
  if (minute > 59) return false;
  if (second > 59) return false;
  return true;
}
