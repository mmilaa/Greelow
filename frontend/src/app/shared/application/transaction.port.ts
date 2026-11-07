import { type Transaction, type TransactionType, type TransactionStatus } from '../domain/transaction';
import { type Page } from '../domain/page';
import { type Money } from '../domain/money';

/**
 * Port for transactions. Abstract class so it doubles as a DI token. Lives in
 * shared/application because more than one feature needs it (transactions lists
 * and creates; accounts reads an account's recent transactions).
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
