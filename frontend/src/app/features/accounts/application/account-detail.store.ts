import { Injectable, computed, inject, signal } from '@angular/core';
import { AccountsStore, type AccountRow } from '../../../shared/application/accounts.store';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';

/** View of the account itself, derived from the shared list + the route id. */
export type AccountView =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-found' }
  | { kind: 'found'; row: AccountRow };

/** State of the recent transactions section (independent of the account). */
export type TransactionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; items: Transaction[] };

const RECENT_PAGE_SIZE = 5;

/**
 * Per-screen store for the account detail. Provided at the component level so it
 * resets between navigations. The account comes from the shared AccountsStore
 * (there is no getById); the transactions are loaded here with a generation
 * guard so a slow response from a previous account never overwrites the current
 * one.
 */
@Injectable()
export class AccountDetailStore {
  private readonly accountsStore = inject(AccountsStore);
  private readonly transactions = inject(TransactionPort);

  private readonly accountId = signal<string | null>(null);
  private readonly transactionsSig = signal<TransactionsState>({ status: 'loading' });
  private generation = 0;

  readonly transactionsState = this.transactionsSig.asReadonly();

  /** The account view: combines the shared list state with the current id. */
  readonly account = computed<AccountView>(() => {
    const id = this.accountId();
    if (id === null) {
      return { kind: 'loading' };
    }
    const listState = this.accountsStore.state();
    switch (listState.status) {
      case 'loading':
        return { kind: 'loading' };
      case 'error':
        return { kind: 'error' };
      case 'empty':
        return { kind: 'not-found' };
      case 'ready': {
        const row = listState.rows.find((r) => r.account.id === id);
        return row ? { kind: 'found', row } : { kind: 'not-found' };
      }
    }
  });

  /**
   * Points the store at an account id. Resets the transactions synchronously (so
   * the previous account's transactions are never shown under the new name),
   * then loads this account's transactions and refreshes the shared list.
   */
  setAccountId(id: string): void {
    this.accountId.set(id);
    this.transactionsSig.set({ status: 'loading' }); // synchronous reset
    // If the list isn't loaded yet, load it once; if it is, refresh it so the
    // balance stays fresh next to freshly fetched transactions. Never both (that
    // would fire two loads).
    if (this.accountsStore.state().status === 'ready') {
      void this.accountsStore.refresh();
    } else {
      void this.accountsStore.ensureLoaded();
    }
    void this.loadTransactions(id);
  }

  /** Retries only the transactions section (does not reload the account). */
  retryTransactions(): void {
    const id = this.accountId();
    if (id !== null) {
      this.transactionsSig.set({ status: 'loading' });
      void this.loadTransactions(id);
    }
  }

  retryAccount(): void {
    void this.accountsStore.ensureLoaded();
  }

  private async loadTransactions(id: string): Promise<void> {
    const gen = ++this.generation;
    let page: { items: Transaction[] };
    try {
      page = await this.transactions.list({ accountId: id, page: 1, pageSize: RECENT_PAGE_SIZE });
    } catch {
      if (gen !== this.generation) return; // a newer navigation started
      this.transactionsSig.set({ status: 'error' });
      return;
    }
    if (gen !== this.generation) return; // check before any state change
    this.transactionsSig.set(
      page.items.length === 0 ? { status: 'empty' } : { status: 'ready', items: page.items },
    );
  }
}
