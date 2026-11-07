import { type Account } from '../domain/account';
import { type Currency } from '../domain/currency';

/**
 * Port for accounts. Abstract class so it doubles as a DI token.
 *
 * Pure TypeScript: no `@angular/*` imports. The HTTP adapter implements it in
 * the infrastructure layer.
 */

/** Command to create an account. The currency is immutable once created. */
export interface CreateAccountInput {
  name: string;
  currency: Currency;
}

export abstract class AccountPort {
  abstract list(): Promise<Account[]>;
  abstract create(input: CreateAccountInput): Promise<Account>;
}
