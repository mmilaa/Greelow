import { type Money } from './money';
import { type Transaction } from './transaction';

/**
 * The minimal transaction shape needed to compute reserved funds: the fields of
 * a domain Transaction that the available-balance rule reads.
 */
export type AccountTransaction = Pick<
  Transaction,
  'accountId' | 'direction' | 'status' | 'amount'
>;

/**
 * Available balance = ledger balance minus outgoing pending transfers of this
 * account. Incoming, completed and failed transactions do not reserve funds, and
 * transactions with a null direction (income/expense) are never reservations.
 *
 * Shared domain rule (used by transfers and by the accounts screen). Pure
 * TypeScript: no `@angular/*` imports.
 */
export function availableBalance(
  balance: Money,
  accountId: string,
  transactions: AccountTransaction[],
): Money {
  return transactions
    .filter(
      (t) => t.accountId === accountId && t.direction === 'out' && t.status === 'pending',
    )
    .reduce((available, t) => available.minus(t.amount), balance);
}
