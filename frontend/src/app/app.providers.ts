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
import { PendingTransfersPort } from './shared/application/pending-transfers.port';
import { PendingTransfersHttpAdapter } from './core/data/pending-transfers-http.adapter';
import { AuthPort } from './features/auth/application/auth.port';
import { AuthHttpAdapter } from './features/auth/infrastructure/auth-http.adapter';
import { TokenStoragePort } from './features/auth/application/token-storage.port';
import { SessionTokenStorage } from './features/auth/infrastructure/session-token-storage.adapter';
import { SessionStore } from './features/auth/application/session.store';
import { ON_UNAUTHENTICATED } from './core/http/on-unauthenticated.token';

/**
 * The single place that binds each application port to its HTTP adapter, and
 * wires the core ON_UNAUTHENTICATED callback to the auth session. Lives at the
 * app root (not in core) so that core depends on no feature. Add this to the
 * app providers.
 */
export const dataAccessProviders: Provider[] = [
  { provide: AccountPort, useClass: AccountHttpAdapter },
  { provide: TransactionPort, useClass: TransactionHttpAdapter },
  { provide: CategoryPort, useClass: CategoryHttpAdapter },
  { provide: TransferPort, useClass: TransferHttpAdapter },
  { provide: PendingTransfersPort, useClass: PendingTransfersHttpAdapter },
  { provide: AuthPort, useClass: AuthHttpAdapter },
  { provide: TokenStoragePort, useClass: SessionTokenStorage },
  {
    provide: ON_UNAUTHENTICATED,
    useFactory: (session: SessionStore) => () => session.expire(),
    deps: [SessionStore],
  },
];
