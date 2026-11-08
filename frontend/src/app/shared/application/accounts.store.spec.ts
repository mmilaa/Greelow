import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AccountsStore } from './accounts.store';
import { AccountPort, type CreateAccountInput } from './account.port';
import { PendingTransfersPort } from './pending-transfers.port';
import { type Account } from '../domain/account';
import { type AccountTransaction } from '../domain/available-balance';
import { Money } from '../domain/money';
import { type Currency } from '../domain/currency';

function account(id: string, balance: number, currency: Currency = 'ARS'): Account {
  return { id, name: `Cuenta ${id}`, currency, balance: Money.fromDecimal(balance, currency), createdAt: '2026-08-01T09:00:00Z' };
}

function pendingOut(accountId: string, amount: number, currency: Currency = 'ARS'): AccountTransaction {
  return { accountId, direction: 'out', status: 'pending', amount: Money.fromDecimal(amount, currency) };
}

class FakeAccounts extends AccountPort {
  listResult: Account[] = [];
  listError: unknown = null;
  listCalls = 0;
  created: CreateAccountInput[] = [];
  createError: unknown = null;
  override async list(): Promise<Account[]> {
    this.listCalls += 1;
    if (this.listError) throw this.listError;
    return this.listResult;
  }
  override async create(input: CreateAccountInput): Promise<Account> {
    if (this.createError) throw this.createError;
    this.created.push(input);
    return account('new', 0, input.currency);
  }
}

class FakePending extends PendingTransfersPort {
  result: AccountTransaction[] = [];
  error: unknown = null;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    if (this.error) throw this.error;
    return this.result;
  }
}

function setup() {
  const accounts = new FakeAccounts();
  const pending = new FakePending();
  TestBed.configureTestingModule({
    providers: [
      AccountsStore,
      { provide: AccountPort, useValue: accounts },
      { provide: PendingTransfersPort, useValue: pending },
    ],
  });
  return { store: TestBed.inject(AccountsStore), accounts, pending };
}

describe('AccountsStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('loads: no pending shows only the ledger balance', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    await store.load();
    const s = store.state();
    expect(s.status).toBe('ready');
    if (s.status !== 'ready') return;
    expect(s.pendingAvailable).toBe(true);
    expect(s.rows[0].hasPending).toBe(false);
    expect(s.rows[0].available!.equals(Money.fromDecimal(1000, 'ARS'))).toBe(true);
  });

  it('with an outgoing pending shows a lower available and the notice flag', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    pending.result = [pendingOut('acc-1', 300)];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.rows[0].hasPending).toBe(true);
    expect(s.rows[0].available!.equals(Money.fromDecimal(700, 'ARS'))).toBe(true);
  });

  it('exposes the raw pendings from the same read when pending is available', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    pending.result = [pendingOut('acc-1', 300)];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    // The transfer validation feeds canTransfer with exactly this array.
    expect(s.pendings).toHaveLength(1);
    expect(s.pendings[0].accountId).toBe('acc-1');
    expect(s.pendings[0].amount.equals(Money.fromDecimal(300, 'ARS'))).toBe(true);
  });

  it('exposes an empty pendings array when pending could not be read', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    pending.error = new Error('pending down');
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.pendingAvailable).toBe(false);
    // Empty, never a partial/unknown list mistaken for "none pending".
    expect(s.pendings).toEqual([]);
  });

  it('incoming and non-pending transfers do not reduce the available', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    pending.result = [
      { accountId: 'acc-1', direction: 'in', status: 'pending', amount: Money.fromDecimal(500, 'ARS') },
      { accountId: 'acc-1', direction: 'out', status: 'completed', amount: Money.fromDecimal(200, 'ARS') },
    ];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.rows[0].available!.equals(Money.fromDecimal(1000, 'ARS'))).toBe(true);
    expect(s.rows[0].hasPending).toBe(false);
  });

  it('keeps two currencies independent and never totals them', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [account('acc-1', 1000, 'ARS'), account('acc-2', 50, 'USD')];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.rows).toHaveLength(2);
    expect(s.rows[0].account.currency).toBe('ARS');
    expect(s.rows[1].account.currency).toBe('USD');
  });

  it('shows a negative balance', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [account('acc-1', -500)];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.rows[0].account.balance.isNegative()).toBe(true);
  });

  it('with no accounts goes empty', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [];
    await store.load();
    expect(store.state().status).toBe('empty');
  });

  it('with a failing account list goes to error', async () => {
    const { store, accounts } = setup();
    accounts.listError = new Error('boom');
    await store.load();
    expect(store.state().status).toBe('error');
  });

  it('with failing pending shows ready with pendingAvailable false (ledger only)', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    pending.error = new Error('pending down');
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.pendingAvailable).toBe(false);
    expect(s.rows[0].available).toBeNull();
  });

  it('requests pending before accounts, in sequence', async () => {
    const { store, accounts, pending } = setup();
    const order: string[] = [];
    accounts.listResult = [account('acc-1', 1000)];
    vi.spyOn(pending, 'pendingOutgoing').mockImplementation(async () => {
      order.push('pending');
      return [];
    });
    vi.spyOn(accounts, 'list').mockImplementation(async () => {
      order.push('accounts');
      return accounts.listResult;
    });
    await store.load();
    expect(order).toEqual(['pending', 'accounts']);
  });

  it('retrying after an error does not leave stale mixed data', async () => {
    const { store, accounts } = setup();
    accounts.listError = new Error('boom');
    await store.load();
    expect(store.state().status).toBe('error');

    accounts.listError = null;
    accounts.listResult = [account('acc-1', 1000)];
    await store.load();
    expect(store.state().status).toBe('ready');
  });

  it('degrades only the row whose availableBalance throws (corrupt data)', async () => {
    const { store, accounts, pending } = setup();
    accounts.listResult = [account('acc-1', 1000, 'ARS'), account('acc-2', 500, 'ARS')];
    // A pending for acc-1 in another currency makes availableBalance throw for acc-1 only.
    pending.result = [pendingOut('acc-1', 100, 'USD')];
    await store.load();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.rows[0].available).toBeNull(); // acc-1 degraded
    expect(s.rows[1].available!.equals(Money.fromDecimal(500, 'ARS'))).toBe(true); // acc-2 ok
  });

  it('a failing refresh keeps the data and marks it stale', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    await store.load();

    accounts.listError = new Error('refresh down');
    await store.refresh();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready (kept)');
    expect(s.stale).toBe(true);
    expect(s.rows[0].account.id).toBe('acc-1');
  });

  it('a successful refresh updates data and clears stale', async () => {
    const { store, accounts } = setup();
    accounts.listResult = [account('acc-1', 1000)];
    await store.load();
    accounts.listError = new Error('x');
    await store.refresh(); // stale
    accounts.listError = null;
    accounts.listResult = [account('acc-1', 2000)];
    await store.refresh();
    const s = store.state();
    if (s.status !== 'ready') throw new Error('expected ready');
    expect(s.stale).toBe(false);
    expect(s.rows[0].account.balance.equals(Money.fromDecimal(2000, 'ARS'))).toBe(true);
  });

  describe('overlapping loads (generation)', () => {
    it('a stale successful response does not overwrite a newer one', async () => {
      const { store, accounts, pending } = setup();
      // First load: slow pending that we control.
      let resolveSlow!: (v: AccountTransaction[]) => void;
      vi.spyOn(pending, 'pendingOutgoing').mockImplementationOnce(
        () => new Promise<AccountTransaction[]>((r) => (resolveSlow = r)),
      );
      accounts.listResult = [account('acc-old', 1)];
      const first = store.load();

      // Second load starts and finishes with fresh data.
      pending.result = [];
      accounts.listResult = [account('acc-new', 2)];
      await store.load();

      // Now the first (older) load resolves.
      resolveSlow([]);
      await first;

      const s = store.state();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.rows[0].account.id).toBe('acc-new');
    });

    it('dataGeneration does not advance for a superseded read', async () => {
      const { store, accounts, pending } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.load();
      const genAfterLoad = store.dataGeneration();

      // A slow refresh that we supersede before it resolves.
      let resolveSlow!: (v: AccountTransaction[]) => void;
      vi.spyOn(pending, 'pendingOutgoing').mockImplementationOnce(
        () => new Promise<AccountTransaction[]>((r) => (resolveSlow = r)),
      );
      const slow = store.refresh();

      // A newer refresh starts and finishes first (supersedes the slow one).
      accounts.listResult = [account('acc-1', 2000)];
      await store.refresh();
      const genAfterNewer = store.dataGeneration();
      expect(genAfterNewer).toBeGreaterThan(genAfterLoad);

      // The slow (superseded) read resolves now: it must NOT advance the
      // applied-data generation, since it did not write the state.
      resolveSlow([]);
      await slow;
      expect(store.dataGeneration()).toBe(genAfterNewer);
    });

    it('a stale FAILING response does not overwrite a newer good one (case F)', async () => {
      const { store, accounts, pending } = setup();
      pending.result = [];

      // First list() hangs until we reject it; second resolves OK.
      let rejectSlow!: (e: unknown) => void;
      let call = 0;
      vi.spyOn(accounts, 'list').mockImplementation(() => {
        call += 1;
        if (call === 1) {
          return new Promise<Account[]>((_r, rej) => (rejectSlow = rej));
        }
        return Promise.resolve([account('acc-new', 2)]);
      });

      const first = store.load();
      // Wait until the first list() is actually in flight (hung).
      await vi.waitFor(() => expect(rejectSlow).toBeTypeOf('function'));

      await store.load(); // newer load finishes OK

      rejectSlow(new Error('old failed')); // older load fails afterwards
      await first.catch(() => undefined);

      const s = store.state();
      expect(s.status).toBe('ready');
      if (s.status === 'ready') {
        expect(s.rows[0].account.id).toBe('acc-new');
      }
    });
  });

  describe('ensureLoaded', () => {
    it('two concurrent calls produce a single load', async () => {
      const { store, accounts, pending } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()]);
      expect(accounts.listCalls).toBe(1);
      expect(pending).toBeDefined();
    });

    it('is a no-op once data is already loaded', async () => {
      const { store, accounts } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.ensureLoaded();
      await store.ensureLoaded();
      expect(accounts.listCalls).toBe(1);
    });

    it('retries after an error', async () => {
      const { store, accounts } = setup();
      accounts.listError = new Error('boom');
      await store.ensureLoaded();
      expect(store.state().status).toBe('error');
      accounts.listError = null;
      accounts.listResult = [account('acc-1', 1000)];
      await store.ensureLoaded();
      expect(store.state().status).toBe('ready');
    });

    it('does not start an extra load when called during an in-flight refresh', async () => {
      const { store, accounts } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.load();
      expect(accounts.listCalls).toBe(1);

      // Start a refresh (in flight) and call ensureLoaded before it resolves.
      const refreshing = store.refresh();
      await store.ensureLoaded(); // must join the in-flight refresh, not add a load
      await refreshing;
      expect(accounts.listCalls).toBe(2); // load + the single refresh, no extra
    });

    it('a stale load finishing later does not clear a newer in-flight promise', async () => {
      const { store, accounts, pending } = setup();
      // First load hangs on pending.
      let resolveSlow!: (v: never[]) => void;
      vi.spyOn(pending, 'pendingOutgoing').mockImplementationOnce(
        () => new Promise((r) => (resolveSlow = r as (v: never[]) => void)),
      );
      accounts.listResult = [account('acc-old', 1)];
      const first = store.ensureLoaded();
      await vi.waitFor(() => expect(resolveSlow).toBeTypeOf('function'));

      // A newer refresh starts and becomes the in-flight promise.
      accounts.listResult = [account('acc-new', 2)];
      const second = store.refresh();

      // Old load resolves now; it must not null out the newer in-flight promise.
      resolveSlow([]);
      await Promise.all([first, second]);
      const s = store.state();
      if (s.status !== 'ready') throw new Error('expected ready');
      expect(s.rows[0].account.id).toBe('acc-new');
    });
  });

  describe('create', () => {
    it('creates an account and reports a successful refresh', async () => {
      const { store, accounts } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.load();
      accounts.listResult = [account('acc-1', 1000), account('acc-2', 0)];

      const result = await store.create({ name: 'Ahorro', currency: 'ARS' });
      expect(result.refreshed).toBe(true);
      expect(accounts.created).toEqual([{ name: 'Ahorro', currency: 'ARS' }]);
    });

    it('reports refreshed=false when the create succeeded but the reload failed', async () => {
      const { store, accounts } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.load();
      accounts.listError = new Error('reload down');

      const result = await store.create({ name: 'Ahorro', currency: 'ARS' });
      expect(result.refreshed).toBe(false);
      const s = store.state();
      if (s.status !== 'ready') throw new Error('expected ready (kept)');
      expect(s.stale).toBe(true);
    });

    it('rejects when the create itself fails (dialog shows the error)', async () => {
      const { store, accounts } = setup();
      accounts.listResult = [account('acc-1', 1000)];
      await store.load();
      accounts.createError = new Error('create down');
      await expect(store.create({ name: 'X', currency: 'ARS' })).rejects.toBeTruthy();
    });
  });
});
