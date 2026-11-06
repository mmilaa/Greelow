import { type Transfer } from '../domain/transfer';
import { type AccountTransaction } from '../domain/transfer-policy';
import { type Money } from '../../../shared/domain/money';

/**
 * Port for transfers. Abstract class so it doubles as a DI token.
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
  /**
   * All outgoing pending transfers of an account, used to compute the available
   * balance. The adapter fetches every page; a partial result is never returned.
   */
  abstract pendingOutgoing(accountId: string): Promise<AccountTransaction[]>;
}
