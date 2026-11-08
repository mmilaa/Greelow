import { type Currency } from './currency';
import { Money } from './money';
import { InvalidAmountError } from './errors';

/**
 * Parses a user-typed amount into Money, without ever going through a float.
 *
 * The cents are built from the digit strings with integer arithmetic (integer
 * part times 100 plus the two-decimal fraction padded), so values like
 * "90071992547408,99" keep full precision instead of being rounded by Number.
 *
 * Rules:
 * - trimmed; only digits with an optional single comma OR dot and 1 or 2
 *   decimals. Thousands separators are NOT accepted ("1.234" and "1.234,56"
 *   are rejected, never guessed).
 * - an optional leading "-" is allowed only so it can be reported as
 *   not-positive (the type, not the sign, decides whether it adds or subtracts).
 * - never throws: `too-large` covers what Money would reject (out of the safe
 *   integer range / infinity). An `ok` result guarantees Money.fromMinor did
 *   not throw.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

export type AmountError =
  | 'empty'
  | 'invalid-format'
  | 'too-many-decimals'
  | 'not-positive'
  | 'too-large';

export type ParseAmountResult =
  | { ok: true; money: Money }
  | { ok: false; reason: AmountError };

// Optional leading "-", one or more ASCII digits, optionally a single comma or
// dot followed by one or more digits. The decimal-count check is done after, so
// "12,345" is reported as too-many-decimals rather than a generic format error.
const SHAPE = /^(-?)(\d+)(?:[.,](\d+))?$/;

export function parseAmountInput(text: string, currency: Currency): ParseAmountResult {
  const trimmed = text.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }

  const match = SHAPE.exec(trimmed);
  if (match === null) {
    return { ok: false, reason: 'invalid-format' };
  }

  const [, sign, intPart, fracPart] = match;

  if (fracPart !== undefined && fracPart.length > 2) {
    return { ok: false, reason: 'too-many-decimals' };
  }

  // Build minor units (cents) with integers only, never via Number(float).
  const frac = (fracPart ?? '').padEnd(2, '0'); // "" -> "00", "5" -> "50"
  const negative = sign === '-';

  let money: Money;
  try {
    const minorAbs = buildMinor(intPart, frac);
    money = Money.fromMinor(negative ? -minorAbs : minorAbs, currency);
  } catch (err) {
    if (err instanceof InvalidAmountError) {
      return { ok: false, reason: 'too-large' };
    }
    throw err; // never swallow anything other than the amount-range error
  }

  if (!money.isPositive()) {
    return { ok: false, reason: 'not-positive' };
  }
  return { ok: true, money };
}

/**
 * Combines the integer and (2-digit) fractional digit strings into a minor-unit
 * amount using integer arithmetic. Throws InvalidAmountError when the result is
 * not a safe integer, which parseAmountInput maps to `too-large`.
 */
function buildMinor(intPart: string, frac2: string): number {
  const intValue = Number(intPart); // digits only; may exceed the safe range
  const fracValue = Number(frac2); // 0..99
  const minor = intValue * 100 + fracValue;
  if (!Number.isSafeInteger(minor)) {
    throw new InvalidAmountError(`amount out of safe range: ${intPart}.${frac2}`);
  }
  return minor;
}
