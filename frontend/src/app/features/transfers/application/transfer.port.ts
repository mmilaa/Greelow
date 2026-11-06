import { type Transfer } from '../domain/transfer';
import { type Money } from '../../../shared/domain/money';

/**
 * Port for transfers. Abstract class so it doubles as a DI token.
 *
 * Reading pending outgoing transfers (for the available balance) now lives in
 * the shared PendingTransfersPort, since several features need it.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */

/** Command to create a transfer. Amount is domain Money. */
export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: Money;
  description?: string;
}

export abstract class TransferPort {
  abstract create(input: CreateTransferInput): Promise<Transfer>;
  abstract getById(id: string): Promise<Transfer>;
}
