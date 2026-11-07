import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransactionsStore } from './transactions.store';
import {
  TransactionPort,
  type TransactionQuery,
} from '../../../shared/application/transaction.port';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';
import { DEFAULT_FILTER, type TransactionFilter } from '../domain/transaction-filter';

function txn(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id, accountId: 'acc-1', type: 'expense', direction: null, status: 'completed',
    amount: Money.fromDecimal(100, 'ARS'), category: 'groceries', description: 'x',
    counterpartAccountId: null, transferId: null, createdAt: '2026-10-20T16:00:00Z',
    ...overrides,
  };
}

function page(items: Transaction[], over: Partial<Page<Transaction>> = {}): Page<Transaction> {
  return { items, page: 1, pageSize: 10, total: items.length, totalPages: 1, ...over };
}

class FakeTransactionPort extends TransactionPort {
  queries: TransactionQuery[] = [];
  result: Page<Transaction> = page([txn('t1')]);
  error: unknown = null;
  impl: ((q: TransactionQuery) => Promise<Page<Transaction>>) | null = null;
  override async list(query: TransactionQuery): Promise<Page<Transaction>> {
    this.queries.push(query);
    if (this.impl) return this.impl(query);
    if (this.error) throw this.error;
    return this.result;
  }
  override create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

function setup() {
  const port = new FakeTransactionPort();
  TestBed.configureTestingModule({
    providers: [TransactionsStore, { provide: TransactionPort, useValue: port }],
  });
  return { store: TestBed.inject(TransactionsStore), port };
}

const filterWith = (over: Partial<TransactionFilter>): TransactionFilter => ({ ...DEFAULT_FILTER, ...over });

describe('TransactionsStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads and maps a ready page with derived totalPages', async () => {
    const { store, port } = setup();
    port.result = page([txn('t1'), txn('t2')], { total: 13, pageSize: 10, page: 1 });
    await store.load(DEFAULT_FILTER);
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.items.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(s.total).toBe(13);
    expect(s.totalPages).toBe(2);
    expect(store.resultCount()).toBe(13);
  });

  it('sends only the active filters and the trimmed search', async () => {
    const { store, port } = setup();
    await store.load(filterWith({ account: 'acc-1', type: 'expense', search: '  super ' }));
    expect(port.queries[0]).toEqual({
      page: 1, pageSize: 10, accountId: 'acc-1', type: 'expense', search: 'super',
    });
  });

  it('empty without filters reports filtered=false', async () => {
    const { store, port } = setup();
    port.result = page([], { total: 0 });
    await store.load(DEFAULT_FILTER);
    const s = store.state();
    expect(s.status).toBe('empty');
    if (s.status === 'empty') expect(s.filtered).toBe(false);
    expect(store.resultCount()).toBe(0);
  });

  it('empty with filters reports filtered=true', async () => {
    const { store, port } = setup();
    port.result = page([], { total: 0 });
    await store.load(filterWith({ search: 'zzz' }));
    const s = store.state();
    if (s.status !== 'empty') throw new Error('expected empty');
    expect(s.filtered).toBe(true);
  });

  it('echoes page and pageSize so the UI can detect out-of-range', async () => {
    const { store, port } = setup();
    port.result = page([], { page: 99, pageSize: 10, total: 13 });
    // page 99 with items -> but here empty; ready vs empty: empty when no items.
    port.result = page([txn('t1')], { page: 99, pageSize: 10, total: 13 });
    await store.load(filterWith({ page: 99 }));
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.page).toBe(99);
    expect(s.total).toBe(13);
    expect(s.totalPages).toBe(2);
  });

  it('goes to error on failure', async () => {
    const { store, port } = setup();
    port.error = new Error('boom');
    await store.load(DEFAULT_FILTER);
    expect(store.state().status).toBe('error');
    expect(store.resultCount()).toBeNull();
  });

  describe('dedupe (against the last successful query)', () => {
    it('does not repeat an identical query', async () => {
      const { store, port } = setup();
      await store.load(DEFAULT_FILTER);
      await store.load(DEFAULT_FILTER);
      expect(port.queries).toHaveLength(1);
    });

    it('repeats when forced (Actualizar)', async () => {
      const { store, port } = setup();
      await store.load(DEFAULT_FILTER);
      await store.load(DEFAULT_FILTER, true);
      expect(port.queries).toHaveLength(2);
    });

    it('a failed query is retried (not deduped)', async () => {
      const { store, port } = setup();
      port.error = new Error('boom');
      await store.load(DEFAULT_FILTER);
      expect(store.state().status).toBe('error');
      port.error = null;
      await store.load(DEFAULT_FILTER);
      expect(port.queries).toHaveLength(2);
      expect(store.state().status).toBe('ready');
    });

    it('a different filter is a new query', async () => {
      const { store, port } = setup();
      await store.load(DEFAULT_FILTER);
      await store.load(filterWith({ type: 'income' }));
      expect(port.queries).toHaveLength(2);
    });
  });

  describe('generation (stale responses)', () => {
    it('shows loading immediately and no stale rows while a new query runs', async () => {
      const { store, port } = setup();
      await store.load(DEFAULT_FILTER); // ready with t1

      let resolveSlow!: (p: Page<Transaction>) => void;
      port.impl = () => new Promise((r) => (resolveSlow = r));
      const second = store.load(filterWith({ type: 'income' }));
      expect(store.state().status).toBe('loading'); // not the old ready rows

      resolveSlow(page([txn('t2')]));
      await second;
      const s = store.state();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.items[0].id).toBe('t2');
    });

    it('a slow old response does not overwrite a newer one', async () => {
      const { store, port } = setup();
      let resolveOld!: (p: Page<Transaction>) => void;
      port.impl = (q) =>
        q.type === 'expense'
          ? new Promise((r) => (resolveOld = r))
          : Promise.resolve(page([txn('new')]));

      const first = store.load(filterWith({ type: 'expense' }));
      await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'));
      await store.load(filterWith({ type: 'income' })); // newer, resolves first

      resolveOld(page([txn('old')])); // older resolves late: must be discarded
      await first;
      const s = store.state();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.items[0].id).toBe('new');
    });

    it('a slow old FAILURE does not overwrite a newer good one', async () => {
      const { store, port } = setup();
      let rejectOld!: (e: unknown) => void;
      port.impl = (q) =>
        q.type === 'expense'
          ? new Promise((_r, rej) => (rejectOld = rej))
          : Promise.resolve(page([txn('new')]));

      const first = store.load(filterWith({ type: 'expense' }));
      await vi.waitFor(() => expect(rejectOld).toBeTypeOf('function'));
      await store.load(filterWith({ type: 'income' }));

      rejectOld(new Error('old failed'));
      await first.catch(() => undefined);
      const s = store.state();
      expect(s.status).toBe('ready');
      if (s.status === 'ready') expect(s.items[0].id).toBe('new');
    });
  });
});
