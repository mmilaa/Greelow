import {
  type Transaction,
  type TransactionType,
  type TransactionDirection,
  type TransactionStatus,
} from '../domain/transaction';
import { Money } from '../domain/money';
import { InvalidDataError } from '../domain/errors';
import {
  requireString,
  requireNumber,
  requireCurrency,
  requireOneOf,
  requireDateString,
  optionalString,
  nullableString,
} from '../domain/parse';

/**
 * Raw transaction shape from the API, plus its mapper. Lives in
 * shared/infrastructure because the Transaction entity crosses features (both
 * transactions and transfers consume it), so no feature imports from another.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface TransactionDto {
  id: unknown;
  accountId: unknown;
  type: unknown;
  direction: unknown;
  status: unknown;
  amount: unknown;
  currency: unknown;
  category?: unknown;
  description?: unknown;
  counterpartAccountId?: unknown;
  transferId?: unknown;
  createdAt?: unknown;
}

const TRANSACTION_TYPES: readonly TransactionType[] = ['income', 'expense', 'transfer'];
const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['pending', 'completed', 'failed'];

/** Parses `direction`, which may be 'in', 'out', or null. */
function parseDirection(value: unknown): TransactionDirection {
  if (value === null || value === undefined) {
    return null;
  }
  return requireOneOf(value, ['in', 'out'] as const, 'direction');
}

/**
 * Enforces coherence between type and direction:
 * - transfers must have a direction ('in' | 'out');
 * - income/expense must NOT have a direction (it must be null).
 */
function assertDirectionMatchesType(type: TransactionType, direction: TransactionDirection): void {
  if (type === 'transfer' && direction === null) {
    throw new InvalidDataError('A transfer transaction must have a direction');
  }
  if (type !== 'transfer' && direction !== null) {
    throw new InvalidDataError(`A ${type} transaction must not have a direction`);
  }
}

/** Maps a transaction DTO to the domain Transaction, throwing InvalidDataError on bad data. */
export function mapTransaction(dto: TransactionDto): Transaction {
  const currency = requireCurrency(dto.currency, 'currency');
  const type = requireOneOf(dto.type, TRANSACTION_TYPES, 'type');
  const direction = parseDirection(dto.direction);
  assertDirectionMatchesType(type, direction);

  return {
    id: requireString(dto.id, 'id'),
    accountId: requireString(dto.accountId, 'accountId'),
    type,
    direction,
    status: requireOneOf(dto.status, TRANSACTION_STATUSES, 'status'),
    amount: Money.fromDecimal(requireNumber(dto.amount, 'amount'), currency),
    category: optionalString(dto.category, 'other') || 'other',
    description: optionalString(dto.description),
    counterpartAccountId: nullableString(dto.counterpartAccountId, 'counterpartAccountId'),
    transferId: nullableString(dto.transferId, 'transferId'),
    createdAt: requireDateString(dto.createdAt, 'createdAt'),
  };
}
