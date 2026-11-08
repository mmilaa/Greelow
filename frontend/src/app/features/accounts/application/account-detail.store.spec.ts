import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccountDetailStore } from './account-detail.store';
import { AccountsStore, type AccountsState, type AccountRow } from '../../../shared/application/accounts.store';
import { TransactionPort, type TransactionQuery } from '../../../shared/application/transaction.port';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';

function account(id: string): Account {
  return { id, name: `Cuenta ${id}`, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

function row(id: string): AccountRow {
  return { account: account(id), available: account(id).balance, hasPending: false };
}

function txn(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id, accountId: 'acc-1', type: 'expense', direction: null, status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'), category: 'other', description: 'x',
    counterpartAccountId: null, transferId: null, createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

class FakeAccountsStore {
  readonly stateSig = signal<AccountsState>({ status: 'loading' });
  state = this.stateSig.asReadonly();
  ensureLoaded = vi.fn().mockResolvedValue(undefined);
  refresh = vi.fn().mockResolvedValue(undefined);
}

class FakeTransactionPort {
  listResult: Transaction[] = [];
  listError: unknown = null;
  lastQuery: TransactionQuery | null = null;
  listImpl: ((q: TransactionQuery) => Promise<{ items: Transaction[] }>) | null = null;
  async list(query: TransactionQuery) {
    this.lastQuery = query;
    if (this.listImpl) return this.listImpl(query);
    if (this.listError) throw this.listError;
    return { items: this.listResult, page: 1, pageSize: 5, total: this.listResult.length, totalPages: 1 };
  }
  create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

function setup() {
  const accountsStore = new FakeAccountsStore();
  const transactions = new FakeTransactionPort();
  TestBed.configureTestingModule({
    providers: [
      AccountDetailStore,
      { provide: AccountsStore, useValue: accountsStore },
      { provide: TransactionPort, useValue: transactions },
    ],
  });
  return { store: TestBed.inject(AccountDetailStore), accountsStore, transactions };
}

describe('AccountDetailStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('account view', () => {
    it('is loading while the list is loading', () => {
      const { store } = setup();
      store.setAccountId('acc-1');
      expect(store.account().kind).toBe('loading');
    });

    it('is error when the list failed', () => {
      const { store, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'error' });
      store.setAccountId('acc-1');
      expect(store.account().kind).toBe('error');
    });

    it('is not-found when the list loaded but the id is absent', () => {
      const { store, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'ready', rows: [row('acc-2')], pendingAvailable: true, stale: false });
      store.setAccountId('acc-1');
      expect(store.account().kind).toBe('not-found');
    });

    it('is not-found when the user has no accounts', () => {
      const { store, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'empty' });
      store.setAccountId('acc-1');
      expect(store.account().kind).toBe('not-found');
    });

    it('is found when the id is in the list', () => {
      const { store, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'ready', rows: [row('acc-1')], pendingAvailable: true, stale: false });
      store.setAccountId('acc-1');
      const v = store.account();
      expect(v.kind).toBe('found');
      if (v.kind === 'found') expect(v.row.account.id).toBe('acc-1');
    });
  });

  describe('transactions', () => {
    it('requests page 1, pageSize 5 and the route accountId', async () => {
      const { store, transactions } = setup();
      transactions.listResult = [txn('t1')];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));
      expect(transactions.lastQuery).toEqual({ accountId: 'acc-1', page: 1, pageSize: 5 });
    });

    it('shows the transactions in the received order', async () => {
      const { store, transactions } = setup();
      transactions.listResult = [txn('t1'), txn('t2'), txn('t3')];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));
      const m = store.transactionsState();
      if (m.status !== 'ready') throw new Error('expected ready');
      expect(m.items.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('is empty when there are no transactions', async () => {
      const { store, transactions } = setup();
      transactions.listResult = [];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('empty'));
    });

    it('is error when the list fails', async () => {
      const { store, transactions } = setup();
      transactions.listError = new Error('boom');
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('error'));
    });

    it('retryTransactions reloads only the section, not the account list', async () => {
      const { store, transactions, accountsStore } = setup();
      transactions.listError = new Error('boom');
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('error'));
      accountsStore.ensureLoaded.mockClear();

      transactions.listError = null;
      transactions.listResult = [txn('t1')];
      store.retryTransactions();
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));
      expect(accountsStore.ensureLoaded).not.toHaveBeenCalled();
    });
  });

  describe('navigation between accounts (generation)', () => {
    it('resets transactions to loading synchronously when the id changes', async () => {
      const { store, transactions } = setup();
      transactions.listResult = [txn('t1')];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));

      store.setAccountId('acc-2'); // synchronous reset
      expect(store.transactionsState().status).toBe('loading');
    });

    it('a slow response from the previous account does not overwrite the new one', async () => {
      const { store, transactions } = setup();
      let resolveSlow!: (v: { items: Transaction[] }) => void;
      transactions.listImpl = (q) => {
        if (q.accountId === 'acc-1') {
          return new Promise((r) => (resolveSlow = r));
        }
        return Promise.resolve({ items: [txn('new')] });
      };
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(resolveSlow).toBeTypeOf('function'));

      store.setAccountId('acc-2');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));

      // Now the slow acc-1 response arrives: must be discarded.
      resolveSlow({ items: [txn('old')] });
      const m = store.transactionsState();
      if (m.status !== 'ready') throw new Error('expected ready');
      expect(m.items[0].id).toBe('new');
    });
  });

  describe('reload', () => {
    it('refreshes the accounts list and re-fetches the transactions', async () => {
      const { store, transactions, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'ready', rows: [row('acc-1')], pendingAvailable: true, stale: false });
      transactions.listResult = [txn('t1')];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));
      accountsStore.refresh.mockClear();

      transactions.listResult = [txn('t2'), txn('t3')];
      store.reload();
      await vi.waitFor(() => {
        const s = store.transactionsState();
        return s.status === 'ready' && s.items.length === 2;
      });
      expect(accountsStore.refresh).toHaveBeenCalledTimes(1);
      const s = store.transactionsState();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.items.map((t) => t.id)).toEqual(['t2', 't3']);
    });

    it('is a no-op when no account is set', () => {
      const { store, accountsStore } = setup();
      store.reload();
      expect(accountsStore.refresh).not.toHaveBeenCalled();
    });

    it('a slow reload response does not overwrite a newer navigation (generation)', async () => {
      const { store, transactions, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'ready', rows: [row('acc-1')], pendingAvailable: true, stale: false });
      transactions.listResult = [txn('t1')];
      store.setAccountId('acc-1');
      await vi.waitFor(() => expect(store.transactionsState().status).toBe('ready'));

      // reload starts a slow transactions fetch...
      let resolveSlow!: (v: { items: Transaction[] }) => void;
      transactions.listImpl = () => new Promise((r) => (resolveSlow = r));
      store.reload();
      await vi.waitFor(() => expect(resolveSlow).toBeTypeOf('function'));

      // ...but a navigation to another account happens first and resolves.
      transactions.listImpl = null;
      transactions.listResult = [txn('new')];
      store.setAccountId('acc-2');
      await vi.waitFor(() => {
        const s = store.transactionsState();
        return s.status === 'ready' && s.items[0]?.id === 'new';
      });

      // The slow reload now resolves: it must be discarded.
      resolveSlow({ items: [txn('stale')] });
      const s = store.transactionsState();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.items[0].id).toBe('new');
    });
  });

  describe('ensureLoaded on entering', () => {
    it('loads the list when it is not ready yet (no double load)', () => {
      const { store, accountsStore } = setup(); // list starts in 'loading'
      store.setAccountId('acc-1');
      expect(accountsStore.ensureLoaded).toHaveBeenCalled();
      expect(accountsStore.refresh).not.toHaveBeenCalled();
    });

    it('refreshes the list when it is already loaded (keeps the balance fresh)', () => {
      const { store, accountsStore } = setup();
      accountsStore.stateSig.set({ status: 'ready', rows: [row('acc-1')], pendingAvailable: true, stale: false });
      store.setAccountId('acc-1');
      expect(accountsStore.refresh).toHaveBeenCalled();
      expect(accountsStore.ensureLoaded).not.toHaveBeenCalled();
    });

    // With the REAL AccountsStore: entering with an unloaded list must do exactly
    // one pending request and one accounts request (not two loads).
    it('entering with an unloaded list makes one pending and one accounts request', async () => {
      const pendingCalls = { n: 0 };
      const accountsCalls = { n: 0 };
      const realAccountsStore = (() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [
            AccountsStore,
            { provide: AccountPort, useValue: { list: async () => { accountsCalls.n++; return [account('acc-1')]; }, create: async () => account('acc-1') } },
            { provide: PendingTransfersPort, useValue: { pendingOutgoing: async () => { pendingCalls.n++; return []; } } },
            { provide: TransactionPort, useValue: { list: async () => ({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }), create: async () => txn('t') } },
          ],
        });
        return TestBed.inject(AccountsStore);
      })();
      const detail = TestBed.runInInjectionContext(() => new AccountDetailStore());

      detail.setAccountId('acc-1');
      await vi.waitFor(() => expect(realAccountsStore.state().status).toBe('ready'));

      expect(pendingCalls.n).toBe(1);
      expect(accountsCalls.n).toBe(1);
    });
  });
});
