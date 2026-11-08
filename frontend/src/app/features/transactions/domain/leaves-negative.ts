import { type Money } from '../../../shared/domain/money';
import { type TransactionType } from '../../../shared/domain/transaction';

/**
 * Whether registering this transaction would leave the account with a negative
 * available balance. Only expenses can (incomes add funds), so the "only
 * expenses" rule lives here in the domain, not in the component.
 *
 * `available` is null when it could not be computed (e.g. pending transfers
 * failed to load): in that case we do not warn.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export function leavesNegative(
  type: TransactionType,
  available: Money | null,
  amount: Money,
): boolean {
  if (type !== 'expense') {
    return false;
  }
  if (available === null) {
    return false;
  }
  // Negative strictly: landing exactly on zero does not warn.
  return available.minus(amount).isNegative();
}
