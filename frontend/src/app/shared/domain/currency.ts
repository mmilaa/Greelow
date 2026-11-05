/**
 * Supported currencies and their minor-unit metadata.
 *
 */

/** Decimal places per currency. The minor-unit factor derives from this map. */
const CURRENCY_DECIMALS = {
  ARS: 2,
  USD: 2,
  EUR: 2,
} as const;

/** A supported ISO-like currency code. */
export type Currency = keyof typeof CURRENCY_DECIMALS;

/** The set of supported currency codes. */
export const CURRENCIES = Object.keys(CURRENCY_DECIMALS) as readonly Currency[];

/** Number of decimal places used by a currency (e.g. ARS -> 2). */
export function currencyDecimals(currency: Currency): number {
  return CURRENCY_DECIMALS[currency];
}

/** Factor to convert between major and minor units (10^decimals, e.g. 100). */
export function minorUnitFactor(currency: Currency): number {
  return 10 ** currencyDecimals(currency);
}

/** Type guard: narrows an unknown value to a supported Currency. */
export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CURRENCY_DECIMALS, value);
}
