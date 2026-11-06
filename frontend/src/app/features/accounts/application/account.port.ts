import { type Account } from '../../../shared/domain/account';

/**
 * Port for reading accounts. Abstract class so it doubles as a DI token.
 *
 * Pure TypeScript: no `@angular/*` imports. The HTTP adapter implements it in
 * the infrastructure layer.
 */
export abstract class AccountPort {
  abstract list(): Promise<Account[]>;
}
