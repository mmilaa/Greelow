import { type Money } from './money';

/**
 * A transaction in an account: income, expense, or one leg of a transfer.
 * Shared by the transactions and transfers features.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionDirection = 'in' | 'out' | null;
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  accountId: string;
  type: TransactionType;
  direction: TransactionDirection;
  status: TransactionStatus;
  amount: Money;
  category: string;
  description: string;
  counterpartAccountId: string | null;
  transferId: string | null;
  /** ISO 8601 timestamp, kept as a string (not converted to Date). */
  createdAt: string;
}
