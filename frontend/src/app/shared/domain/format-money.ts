import { type Money } from './money';

/**
 * Formats a Money value for es-AR using the ISO currency code (e.g.
 * "ARS 1.234,56", negative "-ARS 1.234,56"). The space between code and number
 * is a non-breaking space (U+00A0), as emitted by Intl.NumberFormat.
 *
 * Pure TypeScript: no `@angular/*` imports. The UI MoneyAmount component uses
 * this so the money format is decided in one place, not per screen.
 */
export function formatMoney(money: Money): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: money.currency,
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(money.toDecimal());
}
