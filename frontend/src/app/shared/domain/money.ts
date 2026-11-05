import { type Currency, minorUnitFactor } from './currency';
import { CurrencyMismatchError, InvalidAmountError } from './errors';

/**
 * Money value object: an integer amount in a currency's minor units plus the
 * currency itself. Immutable; arithmetic and comparison require matching
 * currencies.
 *
 */
export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: Currency,
  ) {}

  /** Build from a decimal (major-unit) amount, rounding half-up to minor units. */
  static fromDecimal(amount: number, currency: Currency): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidAmountError(`amount must be a finite number, got ${amount}`);
    }
    const minor = Math.round(amount * minorUnitFactor(currency));
    return new Money(normalizeZero(assertSafeMinor(minor)), currency);
  }

  /** Build directly from an integer minor-unit amount. */
  static fromMinor(amountMinor: number, currency: Currency): Money {
    return new Money(normalizeZero(assertSafeMinor(amountMinor)), currency);
  }

  /** Zero amount in the given currency. */
  static zero(currency: Currency): Money {
    return new Money(0, currency);
  }

  /** Convert back to a decimal (major-unit) amount. */
  toDecimal(): number {
    return this.amountMinor / minorUnitFactor(this.currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  isZero(): boolean {
    return this.amountMinor === 0;
  }

  isNegative(): boolean {
    return this.amountMinor < 0;
  }

  isPositive(): boolean {
    return this.amountMinor > 0;
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor > other.amountMinor;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amountMinor < other.amountMinor;
  }

  /** Value equality: same amount and same currency. */
  equals(other: Money): boolean {
    return this.amountMinor === other.amountMinor && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}

/** Validates that a minor-unit value is an integer within the safe range. */
function assertSafeMinor(minor: number): number {
  if (!Number.isSafeInteger(minor)) {
    throw new InvalidAmountError(`amountMinor must be a safe integer, got ${minor}`);
  }
  return minor;
}

/** Collapses -0 to +0 so the value object never carries a latent negative zero. */
function normalizeZero(minor: number): number {
  return minor === 0 ? 0 : minor;
}
