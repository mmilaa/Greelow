import { type AccountTransaction } from '../domain/available-balance';

/**
 * Port for reading all of the user's outgoing pending transfers (across every
 * account, no accountId filter). availableBalance groups them per account.
 *
 * Shared so any feature (transfers, accounts) can depend on it without importing
 * from another feature. Abstract class so it doubles as a DI token.
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export abstract class PendingTransfersPort {
  abstract pendingOutgoing(): Promise<AccountTransaction[]>;
}
