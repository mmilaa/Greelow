import { type Provider } from '@angular/core';
import { AccountPort } from './features/accounts/application/account.port';
import { AccountHttpAdapter } from './features/accounts/infrastructure/account-http.adapter';
import { TransactionPort, CategoryPort } from './features/transactions/application/transaction.port';
import {
  TransactionHttpAdapter,
  CategoryHttpAdapter,
} from './features/transactions/infrastructure/transaction-http.adapter';
import { TransferPort } from './features/transfers/application/transfer.port';
import { TransferHttpAdapter } from './features/transfers/infrastructure/transfer-http.adapter';

/**
 * The single place that binds each application port to its HTTP adapter. Lives
 * at the app root (not in core) so that core depends on no feature. Add this to
 * the app providers.
 */
export const dataAccessProviders: Provider[] = [
  { provide: AccountPort, useClass: AccountHttpAdapter },
  { provide: TransactionPort, useClass: TransactionHttpAdapter },
  { provide: CategoryPort, useClass: CategoryHttpAdapter },
  { provide: TransferPort, useClass: TransferHttpAdapter },
];
