import { type AccountRow } from '../application/accounts.store';

/** What to open the new-transaction dialog with: an account row and the type. */
export interface NewTransactionRequest {
  row: AccountRow;
  type: 'income' | 'expense';
}

/** Result of the dialog: whether a transaction was actually created. */
export interface NewTransactionResult {
  created: boolean;
}

/**
 * Abstract launcher for the "register income/expense" dialog. Lives in shared
 * so the accounts feature can trigger it without importing the transactions
 * feature (features never import each other). The concrete implementation lives
 * in features/transactions/ui and is bound at the composition root, like the
 * data ports.
 *
 * Abstract class so it doubles as a DI token.
 */
export abstract class NewTransactionLauncher {
  abstract open(request: NewTransactionRequest): Promise<NewTransactionResult>;
}
