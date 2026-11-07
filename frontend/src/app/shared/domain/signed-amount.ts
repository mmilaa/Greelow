import { Money } from './money';
import { type Transaction } from './transaction';

/**
 * The amount of a transaction with its sign applied, as a Money value:
 * - income, or a transfer leg with direction 'in', adds (positive);
 * - expense, or a transfer leg with direction 'out', subtracts (negative).
 *
 * The sign depends only on type/direction, never on the status. Built as
 * `zero.minus(amount)` for outflows, without adding methods to Money.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export function signedAmount(tx: Transaction): Money {
  const inflow = tx.type === 'income' || tx.direction === 'in';
  if (inflow) {
    return tx.amount;
  }
  // expense or direction 'out': negate via zero - amount.
  return Money.zero(tx.amount.currency).minus(tx.amount);
}
