import { type Transaction, type TransactionStatus } from '../../../shared/domain/transaction';

/**
 * A transfer as seen by the current user. Each user only sees the legs that
 * belong to their own accounts, so `from` or `to` may be null (but not both).
 *
 * Pure TypeScript: no `@angular/*` imports.
 */
export interface Transfer {
  id: string;
  status: TransactionStatus;
  from: Transaction | null;
  to: Transaction | null;
}
