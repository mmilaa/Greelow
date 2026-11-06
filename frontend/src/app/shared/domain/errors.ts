/**
 * Common domain errors for the shared layer.
 *
 */

/** Base class for all domain errors, so they can be caught as a group. */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when an operation mixes two different currencies. */
export class CurrencyMismatchError extends DomainError {
  constructor(
    readonly left: string,
    readonly right: string,
  ) {
    super(`Cannot operate on different currencies: ${left} and ${right}`);
  }
}

/** Raised when a monetary amount is invalid (NaN, Infinity, non-integer minor units, or out of safe range). */
export class InvalidAmountError extends DomainError {}

/** Raised when raw API data cannot be mapped to a valid domain value (missing or invalid field). */
export class InvalidDataError extends DomainError {}
