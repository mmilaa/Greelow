import { InvalidDataError } from './errors';
import { type Currency, isCurrency } from './currency';

/**
 * Small parsing helpers shared by the infrastructure mappers. They throw
 * InvalidDataError when a field that affects the meaning of the data is missing
 * or invalid, so a corrupt item never silently disappears from a list.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidDataError(`Expected a non-empty string for "${field}"`);
  }
  return value;
}

export function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidDataError(`Expected a finite number for "${field}"`);
  }
  return value;
}

export function requireCurrency(value: unknown, field: string): Currency {
  if (!isCurrency(value)) {
    throw new InvalidDataError(`Expected a valid currency for "${field}", got ${String(value)}`);
  }
  return value;
}

/** Requires that `value` is one of `allowed`; throws InvalidDataError otherwise. */
export function requireOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new InvalidDataError(`Expected one of [${allowed.join(', ')}] for "${field}", got ${String(value)}`);
  }
  return value as T;
}

/** Optional string, normalized to '' when absent or not a string. */
export function optionalString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** A nullable string field: returns the string, or null when null/undefined; throws on other types. */
export function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new InvalidDataError(`Expected a string or null for "${field}"`);
  }
  return value;
}
