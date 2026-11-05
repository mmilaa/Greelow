import { Money } from '../../../shared/domain/money';
import { type Currency } from '../../../shared/domain/currency';
import { CurrencyMismatchError } from '../../../shared/domain/errors';

/**
 * Transfer policy: the single place that decides whether a transfer is allowed.
 *
 * Pure TypeScript: only depends on shared/domain, never on `@angular/*`.
 */

/** Minimal movement shape the policy needs to compute reserved funds. */
export interface TransferMovement {
  accountId: string;
  direction: 'in' | 'out' | null;
  status: 'pending' | 'completed' | 'failed';
  amount: Money;
}

/** Source account, reduced to what the policy reasons about. */
export interface TransferSource {
  accountId: string;
  currency: Currency;
  balance: Money;
}

/**
 * Destination of a transfer. An own account has a known currency; an external
 * account (another user) does not, so its currency can never be verified.
 */
export type TransferDestination =
  | { kind: 'own'; accountId: string; currency: Currency }
  | { kind: 'external'; accountId: string };

export interface TransferRequest {
  source: TransferSource;
  destination: TransferDestination;
  amount: Money;
  movements: TransferMovement[];
}

/** Why a transfer was blocked. The UI layer maps each reason to a message. */
export type TransferBlockReason =
  | 'same-account'
  | 'non-positive-amount'
  | 'unknown-destination-currency'
  | 'cross-currency'
  | 'insufficient-funds';

export type TransferCheck =
  | { allowed: true }
  | { allowed: false; reason: TransferBlockReason };

/**
 * Available balance = ledger balance minus outgoing pending transfers of this
 * account. Incoming, completed and failed movements do not reserve funds, and
 * movements with a null direction (income/expense) are never reservations.
 */
export function availableBalance(
  balance: Money,
  accountId: string,
  movements: TransferMovement[],
): Money {
  return movements
    .filter(
      (m) =>
        m.accountId === accountId &&
        m.direction === 'out' &&
        m.status === 'pending',
    )
    .reduce((available, m) => available.minus(m.amount), balance);
}

/**
 * Decides whether a transfer is allowed. The amount must be in the source
 * account currency; a mismatch is a caller bug and throws CurrencyMismatchError
 * deterministically, before any block reason is considered.
 */
export function canTransfer(request: TransferRequest): TransferCheck {
  const { source, destination, amount, movements } = request;

  // Deterministic currency contract: the amount must be in the source currency.
  // A mismatch is a caller bug, checked explicitly before any block reason.
  if (amount.currency !== source.currency) {
    throw new CurrencyMismatchError(source.currency, amount.currency);
  }

  if (destination.accountId === source.accountId) {
    return blocked('same-account');
  }

  if (!amount.isPositive()) {
    return blocked('non-positive-amount');
  }

  if (destination.kind === 'external') {
    return blocked('unknown-destination-currency');
  }

  if (destination.currency !== source.currency) {
    return blocked('cross-currency');
  }

  const available = availableBalance(source.balance, source.accountId, movements);
  if (amount.isGreaterThan(available)) {
    return blocked('insufficient-funds');
  }

  return { allowed: true };
}

function blocked(reason: TransferBlockReason): TransferCheck {
  return { allowed: false, reason };
}
