import { InvalidDataError } from './errors';
import { isValidIsoDateTime } from './iso-date';

/**
 * Formats an ISO 8601 timestamp (with zone) as an es-AR date and time, with
 * dateStyle 'medium' and timeStyle 'short'. The time zone defaults to the
 * runtime's local zone; callers (and tests) may pass an explicit zone.
 *
 * Throws InvalidDataError if the input is not a strictly valid ISO date-time.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export function formatDateTime(iso: string, timeZone?: string): string {
  if (!isValidIsoDateTime(iso)) {
    throw new InvalidDataError(`Invalid ISO date-time: ${iso}`);
  }
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(iso));
}
