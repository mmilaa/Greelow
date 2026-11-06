import { type Money } from './money';
import { type Currency } from './currency';

/**
 * An account with its ledger balance. Shared by the accounts and transfers features.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface Account {
  id: string;
  name: string;
  currency: Currency;
  /** Ledger balance reported by the API. May be negative. */
  balance: Money;
  /** ISO 8601 timestamp, kept as a string. */
  createdAt: string;
}
