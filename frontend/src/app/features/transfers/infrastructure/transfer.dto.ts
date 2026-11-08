import { type Transfer } from '../domain/transfer';
import { type Transaction, type TransactionStatus } from '../../../shared/domain/transaction';
import { Money } from '../../../shared/domain/money';
import { InvalidDataError } from '../../../shared/domain/errors';
import { requireOneOf } from '../../../shared/domain/parse';
import {
  type TransactionDto,
  mapTransaction,
} from '../../../shared/infrastructure/transaction.dto';

/**
 * Raw transfer shape from the API (`POST /transfers`, `GET /transfers/:id`).
 * Each leg (`from`/`to`) may be null.
 *
 * The transaction DTO + mapper for each leg come from shared/infrastructure, so
 * this feature imports only from shared, never from the transactions feature.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface TransferDto {
  id: unknown;
  status: unknown;
  from: unknown;
  to: unknown;
}

const TRANSACTION_STATUSES: readonly TransactionStatus[] = ['pending', 'completed', 'failed'];

/** Maps one transfer leg: a transaction DTO, or null. */
function mapLeg(value: unknown): Transaction | null {
  if (value === null || value === undefined) {
    return null;
  }
  return mapTransaction(value as TransactionDto);
}

/**
 * Maps a transfer DTO to the domain Transfer. Throws InvalidDataError if both
 * legs are null (there would be nothing to show).
 */
export function mapTransfer(dto: TransferDto): Transfer {
  // Guard the shape before reading fields: a missing/non-object DTO (e.g. the
  // envelope was not unwrapped, or a corrupt 2xx body) is invalid data, not a
  // TypeError. runRequest turns InvalidDataError into `invalid-response`.
  if (typeof dto !== 'object' || dto === null) {
    throw new InvalidDataError('Expected a transfer object');
  }
  const from = mapLeg(dto.from);
  const to = mapLeg(dto.to);
  if (from === null && to === null) {
    throw new InvalidDataError('A transfer must have at least one visible leg (from or to)');
  }
  return {
    id: requireIdLike(dto.id),
    status: requireOneOf(dto.status, TRANSACTION_STATUSES, 'status'),
    from,
    to,
  };
}

function requireIdLike(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidDataError('Expected a non-empty string for transfer "id"');
  }
  return value;
}

// --- request mapper (domain -> API body) --------------------------------

/** Body to create a transfer. Amount goes back to a decimal. */
export interface CreateTransferBody {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
}

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  description?: string;
}

/** Maps a create-transfer command to the API request body. */
export function toCreateTransferBody(input: CreateTransferInput): CreateTransferBody {
  const body: CreateTransferBody = {
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: input.amount.toDecimal(),
  };
  if (input.description !== undefined) {
    body.description = input.description;
  }
  return body;
}
