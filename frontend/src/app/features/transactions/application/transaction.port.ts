import { type Transaction, type TransactionType, type TransactionStatus } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { type Money } from '../../../shared/domain/money';

/**
 * Ports for transactions and categories. Abstract classes so they double as DI
 * tokens. CategoryPort lives here (no separate categories feature).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

/** Filters for listing transactions. All fields optional and combinable. */
export interface TransactionQuery {
  accountId?: string;
  type?: TransactionType;
  category?: string;
  status?: TransactionStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** Command to create an income/expense transaction. Amount is domain Money. */
export interface CreateTransactionInput {
  accountId: string;
  type: 'income' | 'expense';
  amount: Money;
  category?: string;
  description?: string;
}

export abstract class TransactionPort {
  abstract list(query: TransactionQuery): Promise<Page<Transaction>>;
  abstract create(input: CreateTransactionInput): Promise<Transaction>;
}

export abstract class CategoryPort {
  abstract list(): Promise<string[]>;
}
