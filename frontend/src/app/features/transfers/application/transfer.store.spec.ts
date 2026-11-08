import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferStore, type TransferRequest } from './transfer.store';
import { TransferTracker } from './transfer-tracker';
import { TransferPort, type CreateTransferInput } from './transfer.port';
import { type Transfer } from '../domain/transfer';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { AccountPort, type CreateAccountInput } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { TransactionPort, type TransactionQuery } from '../../../shared/application/transaction.port';
import { type Account } from '../../../shared/domain/account';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { type Transaction } from '../../../shared/domain/transaction';
import { type Page } from '../../../shared/domain/page';
import { Money } from '../../../shared/domain/money';
import { type Currency } from '../../../shared/domain/currency';
import { ApiErrorException, type ApiError } from '../../../shared/domain/map-api-error';

// --- fakes ---------------------------------------------------------------

function account(id: string, balance: number, currency: Currency = 'ARS'): Account {
  return {
    id,
    name: `Cuenta ${id}`,
    currency,
    balance: Money.fromDecimal(balance, currency),
    createdAt: '2026-08-01T09:00:00Z',
  };
}

function pendingOut(accountId: string, amount: number, currency: Currency = 'ARS'): AccountTransaction {
  return { accountId, direction: 'out', status: 'pending', amount: Money.fromDecimal(amount, currency) };
}

class FakeAccounts extends AccountPort {
  listResult: Account[] = [];
  listCalls = 0;
  override async list(): Promise<Account[]> {
    this.listCalls += 1;
    return this.listResult;
  }
  override async create(_: CreateAccountInput): Promise<Account> {
    throw new Error('not used');
  }
}

class FakePending extends PendingTransfersPort {
  result: AccountTransaction[] = [];
  error: unknown = null;
  calls = 0;
  /** Optional gate: when set, each call awaits it before resolving (for races). */
  gate: Promise<void> | null = null;
  /** When set, the call at this 1-based index (and later) throws (for verification). */
  failFromCall: number | null = null;
  override async pendingOutgoing(): Promise<AccountTransaction[]> {
    this.calls += 1;
    if (this.gate) await this.gate;
    if (this.failFromCall !== null && this.calls >= this.failFromCall) {
      throw new Error('pending down (scripted)');
    }
    if (this.error) throw this.error;
    return this.result;
  }
}

class FakeTransactions extends TransactionPort {
  listResult: Transaction[] = [];
  listError: unknown = null;
  listQueries: TransactionQuery[] = [];
  /** Optional gate to hold the verification list read open (for cancel tests). */
  gate: Promise<void> | null = null;
  override async list(query: TransactionQuery): Promise<Page<Transaction>> {
    this.listQueries.push(query);
    if (this.gate) await this.gate;
    if (this.listError) throw this.listError;
    return { items: this.listResult, page: 1, pageSize: 5, total: this.listResult.length, totalPages: 1 };
  }
  override async create(): Promise<Transaction> {
    throw new Error('not used');
  }
}

class FakeTransfers extends TransferPort {
  createCalls = 0;
  createResult: Transfer | null = null;
  createError: ApiError | null = null;
  /** Lets a test hold the create promise open to test the double-submit guard. */
  createGate: Promise<void> | null = null;
  override async create(_: CreateTransferInput): Promise<Transfer> {
    this.createCalls += 1;
    if (this.createGate) await this.createGate;
    if (this.createError) throw new ApiErrorException(this.createError);
    return this.createResult ?? { id: 't-1', status: 'pending', from: null, to: {} as never };
  }
  override async getById(id: string): Promise<Transfer> {
    return { id, status: 'pending', from: null, to: {} as never };
  }
}

/** A tracker fake so the store spec stays free of timers (timers are tested in the tracker spec). */
class FakeTracker {
  startCalls = 0;
  lastId: string | null = null;
  state = () => ({ phase: 'idle' as const });
  private resolve: ((o: 'confirmed' | 'failed' | 'unconfirmed' | 'unauthenticated') => void) | null = null;
  start(id: string): Promise<'confirmed' | 'failed' | 'unconfirmed' | 'unauthenticated'> {
    this.startCalls += 1;
    this.lastId = id;
    return new Promise((r) => (this.resolve = r));
  }
  /** Drives the tracked outcome from a test. */
  finish(outcome: 'confirmed' | 'failed' | 'unconfirmed' | 'unauthenticated') {
    this.resolve?.(outcome);
  }
  async verifyAgain(): Promise<'confirmed' | 'failed' | 'unconfirmed' | 'unauthenticated'> {
    return 'unconfirmed';
  }
  cancel() {}
}

function setup(seed?: { accounts?: Account[]; pendings?: AccountTransaction[] }) {
  const accounts = new FakeAccounts();
  const pending = new FakePending();
  const transactions = new FakeTransactions();
  const transfers = new FakeTransfers();
  const tracker = new FakeTracker();
  accounts.listResult = seed?.accounts ?? [account('acc-1', 1000), account('acc-2', 500, 'USD')];
  pending.result = seed?.pendings ?? [];

  TestBed.configureTestingModule({
    providers: [
      AccountsStore,
      TransferStore,
      { provide: AccountPort, useValue: accounts },
      { provide: PendingTransfersPort, useValue: pending },
      { provide: TransactionPort, useValue: transactions },
      { provide: TransferPort, useValue: transfers },
      { provide: TransferTracker, useValue: tracker },
    ],
  });
  const accountsStore = TestBed.inject(AccountsStore);
  const store = TestBed.inject(TransferStore);
  return { store, accountsStore, accounts, pending, transactions, transfers, tracker };
}

function ownTo(accountId: string, currency: Currency) {
  return { kind: 'own', accountId, currency } as const;
}

function req(partial: Partial<TransferRequest> & { fromAccountId: string }): TransferRequest {
  return {
    destination: ownTo('acc-9', 'ARS'),
    amount: Money.fromDecimal(100, 'ARS'),
    ...partial,
  };
}

// --- tests ---------------------------------------------------------------

describe('TransferStore', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('valid transfer: fresh read, a single create, then tracking', async () => {
    const { store, accountsStore, transfers, tracker } = setup();
    await accountsStore.load();

    await store.submit(req({ fromAccountId: 'acc-1', destination: ownTo('acc-9', 'ARS'), amount: Money.fromDecimal(100, 'ARS') }));

    expect(transfers.createCalls).toBe(1);
    expect(tracker.startCalls).toBe(1);
    const s = store.state();
    expect(s.status).toBe('tracking');
  });

  it('cross-currency is blocked and create is never called', async () => {
    const { store, accountsStore, transfers } = setup();
    await accountsStore.load();
    await store.submit(
      req({ fromAccountId: 'acc-1', destination: ownTo('acc-2', 'USD'), amount: Money.fromDecimal(100, 'ARS') }),
    );
    const s = store.state();
    expect(s.status).toBe('blocked');
    if (s.status === 'blocked') expect(s.reason).toBe('cross-currency');
    expect(transfers.createCalls).toBe(0);
  });

  it('amount over available is blocked with the available balance', async () => {
    const { store, accountsStore, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    await store.submit(
      req({ fromAccountId: 'acc-1', destination: ownTo('acc-9', 'ARS'), amount: Money.fromDecimal(1000.01, 'ARS') }),
    );
    const s = store.state();
    expect(s.status).toBe('blocked');
    if (s.status === 'blocked') {
      expect(s.reason).toBe('insufficient-funds');
      expect(s.available!.equals(Money.fromDecimal(1000, 'ARS'))).toBe(true);
    }
    expect(transfers.createCalls).toBe(0);
  });

  it('overdraft via a pending reservation is blocked (fresh read includes it)', async () => {
    // 06-race-condition: ledger 848987.66, one 509392 pending out => available 339595.66.
    const { store, accountsStore, transfers } = setup({
      accounts: [account('acc-1', 848987.66)],
      pendings: [pendingOut('acc-1', 509392)],
    });
    await accountsStore.load();
    await store.submit(
      req({ fromAccountId: 'acc-1', destination: ownTo('acc-9', 'ARS'), amount: Money.fromDecimal(509392, 'ARS') }),
    );
    const s = store.state();
    expect(s.status).toBe('blocked');
    if (s.status === 'blocked') expect(s.reason).toBe('insufficient-funds');
    expect(transfers.createCalls).toBe(0);
  });

  it('a failing pending read blocks with available-unknown, no create, retryable', async () => {
    const { store, accountsStore, pending, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    pending.error = new Error('pending down');
    await store.submit(req({ fromAccountId: 'acc-1' }));
    const s = store.state();
    expect(s.status).toBe('blocked');
    if (s.status === 'blocked') expect(s.reason).toBe('available-unknown');
    expect(transfers.createCalls).toBe(0);
  });

  it('a superseded fresh read is retried, and once it applies, validation proceeds', async () => {
    // submit captures dataGeneration before refresh(). If a newer load
    // superseded ours (its result not applied yet), dataGeneration has NOT
    // advanced, so freshReadApplied retries once. On the retry it applies and
    // validation proceeds on fresh, post-submit data (never on the stale read).
    const { store, accountsStore, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    const base = accountsStore.dataGeneration();

    const genSpy = vi.spyOn(accountsStore, 'dataGeneration');
    // before=base (1st read), after 1st refresh still base (superseded),
    // before 2nd read base, after 2nd refresh base+1 (applied).
    genSpy
      .mockReturnValueOnce(base) // before, attempt 0
      .mockReturnValueOnce(base) // after refresh, attempt 0 -> not advanced
      .mockReturnValueOnce(base) // before, attempt 1
      .mockReturnValueOnce(base + 1); // after refresh, attempt 1 -> advanced
    const refreshSpy = vi.spyOn(accountsStore, 'refresh').mockResolvedValue(undefined);

    await store.submit(req({ fromAccountId: 'acc-1' }));

    expect(refreshSpy).toHaveBeenCalledTimes(2); // superseded once, retried once
    // State is read AFTER the gen spy's scripted calls are exhausted; the real
    // state is still the loaded ready data, so validation proceeds to tracking.
    expect(store.state().status).toBe('tracking');
    expect(transfers.createCalls).toBe(1);
  });

  it('blocks with available-unknown when every fresh read is superseded', async () => {
    // Pathological case: both the read and its retry are superseded, so
    // dataGeneration never advances past what submit captured. The store must
    // block, never validate on stale data.
    const { store, accountsStore, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    const base = accountsStore.dataGeneration();

    vi.spyOn(accountsStore, 'dataGeneration').mockReturnValue(base); // never advances
    vi.spyOn(accountsStore, 'refresh').mockResolvedValue(undefined);

    await store.submit(req({ fromAccountId: 'acc-1' }));

    const s = store.state();
    expect(s.status).toBe('blocked');
    if (s.status === 'blocked') expect(s.reason).toBe('available-unknown');
    expect(transfers.createCalls).toBe(0);
  });

  it('available-unknown followed by a retry that reads succeeds', async () => {
    const { store, accountsStore, pending, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    pending.error = new Error('pending down');
    await store.submit(req({ fromAccountId: 'acc-1' }));
    expect(store.state().status).toBe('blocked');

    // The block is not sticky: once idle again, a submit that reads OK proceeds.
    store.reset();
    pending.error = null;
    await store.submit(req({ fromAccountId: 'acc-1' }));
    expect(transfers.createCalls).toBe(1);
    expect(store.state().status).toBe('tracking');
  });

  describe('known create errors return to idle with a typed error', () => {
    const cases: Array<[string, ApiError]> = [
      ['422 insufficient-funds', { kind: 'insufficient-funds' }],
      ['400 validation', { kind: 'validation', fields: [] }],
      ['400 same-account', { kind: 'same-account' }],
      ['404 not-found', { kind: 'not-found' }],
      ['401 unauthenticated', { kind: 'unauthenticated' }],
    ];
    for (const [name, error] of cases) {
      it(name, async () => {
        const { store, accountsStore, transfers, tracker } = setup({ accounts: [account('acc-1', 1000)] });
        await accountsStore.load();
        transfers.createError = error;
        await store.submit(req({ fromAccountId: 'acc-1' }));
        const s = store.state();
        expect(s.status).toBe('idle');
        if (s.status === 'idle') expect(s.lastError).toEqual(error);
        expect(tracker.startCalls).toBe(0); // no tracking
      });
    }
  });

  it('a double submit fires a single create (synchronous guard)', async () => {
    const { store, accountsStore, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    // Hold the create open so the second submit arrives while the first is in flight.
    let openGate!: () => void;
    transfers.createGate = new Promise<void>((r) => (openGate = () => r()));

    const first = store.submit(req({ fromAccountId: 'acc-1' }));
    const second = store.submit(req({ fromAccountId: 'acc-1' })); // guard: not idle
    openGate();
    await Promise.all([first, second]);
    expect(transfers.createCalls).toBe(1);
  });

  it('tracking from A blocks a new transfer from A but allows one from B', async () => {
    const { store, accountsStore, transfers, tracker } = setup({
      accounts: [account('acc-A', 1000), account('acc-B', 1000)],
    });
    await accountsStore.load();

    await store.submit(req({ fromAccountId: 'acc-A' }));
    expect(store.state().status).toBe('tracking');
    expect(store.canSubmitFrom('acc-A')).toBe(false);
    expect(store.canSubmitFrom('acc-B')).toBe(true);

    // While A is tracking the store is busy, so submit() from A no-ops anyway;
    // the per-source flag is what the screen reads to disable A's form.
    expect(transfers.createCalls).toBe(1);
    expect(tracker.lastId).toBe('t-1');
  });

  describe('terminal refresh', () => {
    it('refreshes AccountsStore once when confirmed', async () => {
      const { store, accountsStore, accounts, tracker } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      const before = accounts.listCalls; // load (1) + submit's fresh read (1)
      await store.submit(req({ fromAccountId: 'acc-1' }));
      const afterSubmit = accounts.listCalls;
      expect(afterSubmit).toBe(before + 1);

      tracker.finish('confirmed');
      await Promise.resolve();
      await Promise.resolve();
      expect(store.state().status).toBe('confirmed');
      expect(accounts.listCalls).toBe(afterSubmit + 1); // one refresh
    });

    it('refreshes AccountsStore once when failed too', async () => {
      const { store, accountsStore, accounts, tracker } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      await store.submit(req({ fromAccountId: 'acc-1' }));
      const afterSubmit = accounts.listCalls;

      tracker.finish('failed');
      await Promise.resolve();
      await Promise.resolve();
      expect(store.state().status).toBe('failed');
      expect(accounts.listCalls).toBe(afterSubmit + 1);
    });

    it('does NOT refresh when unconfirmed', async () => {
      const { store, accountsStore, accounts, tracker } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      await store.submit(req({ fromAccountId: 'acc-1' }));
      const afterSubmit = accounts.listCalls;

      tracker.finish('unconfirmed');
      await Promise.resolve();
      expect(store.state().status).toBe('unconfirmed');
      expect(accounts.listCalls).toBe(afterSubmit); // no extra refresh
    });
  });

  describe('uncertain create result', () => {
    it('network error: uncertain + verification, retry allowed after it finishes', async () => {
      const { store, accountsStore, transfers, transactions, pending } = setup({
        accounts: [account('acc-1', 1000)],
      });
      await accountsStore.load();
      transfers.createError = { kind: 'network' };
      // The list brings BOTH legs (in and out); only 'out' must survive (b).
      transactions.listResult = [
        {
          id: 'tx-out', accountId: 'acc-1', type: 'transfer', direction: 'out', status: 'pending',
          amount: Money.fromDecimal(100, 'ARS'), category: 'transfer', description: '',
          counterpartAccountId: 'acc-9', transferId: 't-x', createdAt: '2026-11-07T10:00:00Z',
        },
        {
          id: 'tx-in', accountId: 'acc-1', type: 'transfer', direction: 'in', status: 'completed',
          amount: Money.fromDecimal(50, 'ARS'), category: 'transfer', description: '',
          counterpartAccountId: 'acc-7', transferId: 't-y', createdAt: '2026-11-07T09:00:00Z',
        },
      ];
      // pendingOutgoing has no accountId filter; a pending from ANOTHER account
      // must be filtered out by source (a).
      pending.result = [pendingOut('acc-1', 100), pendingOut('acc-2', 999)];

      await store.submit(req({ fromAccountId: 'acc-1' }));
      // Let the verification promise resolve.
      await Promise.resolve();
      await Promise.resolve();

      const s = store.state();
      expect(s.status).toBe('uncertain');
      if (s.status === 'uncertain') {
        expect(s.kind).toBe('network');
        expect(s.verifying).toBe(false);
        // (b) only the outgoing leg survives.
        expect(s.verification!.recentOutgoing.map((t) => t.id)).toEqual(['tx-out']);
        // (a) only the source account's pending survives.
        expect(s.verification!.outgoingPending).toHaveLength(1);
        expect(s.verification!.outgoingPending[0].accountId).toBe('acc-1');
        expect(s.verification!.readFailed).toBe(false);
      }
      // The list query is scoped correctly.
      expect(transactions.listQueries.at(-1)).toMatchObject({ accountId: 'acc-1', type: 'transfer', page: 1, pageSize: 5 });

      // Retry returns to idle.
      store.retryAfterNetwork();
      expect(store.state().status).toBe('idle');
    });

    it('invalid-response: uncertain, no tracking, retryAfterNetwork is a no-op', async () => {
      const { store, accountsStore, transfers, tracker } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      transfers.createError = { kind: 'invalid-response' };

      await store.submit(req({ fromAccountId: 'acc-1' }));
      await Promise.resolve();
      await Promise.resolve();

      const s = store.state();
      expect(s.status).toBe('uncertain');
      if (s.status === 'uncertain') expect(s.kind).toBe('invalid-response');
      expect(tracker.startCalls).toBe(0);

      // "Intentar de nuevo" must NOT apply to invalid-response (would duplicate).
      store.retryAfterNetwork();
      expect(store.state().status).toBe('uncertain');
    });

    it('a failing verification still exits uncertain with readFailed=true', async () => {
      const { store, accountsStore, transfers, transactions, pending } = setup({
        accounts: [account('acc-1', 1000)],
      });
      await accountsStore.load();
      transfers.createError = { kind: 'network' };
      // The fresh read during validation must succeed (pending OK) so the flow
      // reaches create; the FAILURE we exercise is in the verification read: the
      // recent-transfers list throws, which sets readFailed.
      transactions.listError = new Error('list down');

      await store.submit(req({ fromAccountId: 'acc-1' }));
      await Promise.resolve();
      await Promise.resolve();

      const s = store.state();
      expect(s.status).toBe('uncertain');
      if (s.status === 'uncertain') {
        expect(s.verifying).toBe(false);
        expect(s.verification!.readFailed).toBe(true);
      }
      store.retryAfterNetwork(); // still allowed
      expect(store.state().status).toBe('idle');
    });

    it('a failing PENDING verification read also sets readFailed and still allows exit (c)', async () => {
      const { store, accountsStore, transfers, pending } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load(); // pending call #1
      transfers.createError = { kind: 'network' };
      // Validation's fresh read (refresh) uses pending call #2 and must succeed;
      // the verification's pending read is call #3 and must FAIL.
      pending.failFromCall = 3;

      await store.submit(req({ fromAccountId: 'acc-1' }));
      await Promise.resolve();
      await Promise.resolve();

      const s = store.state();
      expect(s.status).toBe('uncertain');
      if (s.status === 'uncertain') {
        expect(s.verifying).toBe(false);
        expect(s.verification!.readFailed).toBe(true);
        expect(s.verification!.outgoingPending).toEqual([]); // pending read failed
      }
      store.retryAfterNetwork(); // exit still enabled despite the failed read
      expect(store.state().status).toBe('idle');
    });

    it('cancelling verification is not clobbered by the late read (d)', async () => {
      const { store, accountsStore, transfers, transactions } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      transfers.createError = { kind: 'network' };
      // Hold the verification's transaction-list read open so verifying stays true.
      let release!: () => void;
      transactions.gate = new Promise<void>((r) => (release = () => r()));

      await store.submit(req({ fromAccountId: 'acc-1' }));
      await Promise.resolve();
      // Verification is in flight: uncertain with verifying=true.
      const s1 = store.state();
      expect(s1.status).toBe('uncertain');
      if (s1.status === 'uncertain') expect(s1.verifying).toBe(true);

      // The user leaves the uncertain screen (reset -> idle) before it finishes.
      store.reset();
      expect(store.state().status).toBe('idle');

      // The held read resolves now: it must NOT resurrect the uncertain state.
      release();
      await Promise.resolve();
      await Promise.resolve();
      expect(store.state().status).toBe('idle');
    });

    it('a confirmation during "Verificar de nuevo" refreshes AccountsStore once (e)', async () => {
      const { store, accountsStore, accounts, transfers, tracker } = setup({ accounts: [account('acc-1', 1000)] });
      await accountsStore.load();
      await store.submit(req({ fromAccountId: 'acc-1' }));
      // Drive the tracker to unconfirmed.
      tracker.finish('unconfirmed');
      await Promise.resolve();
      expect(store.state().status).toBe('unconfirmed');
      const afterUnconfirmed = accounts.listCalls; // no refresh on unconfirmed

      // verifyAgain confirms this time.
      vi.spyOn(tracker, 'verifyAgain').mockResolvedValue('confirmed');
      await store.verifyAgain();
      await Promise.resolve();
      expect(store.state().status).toBe('confirmed');
      // Exactly one refresh happened as a result of the late confirmation.
      expect(accounts.listCalls).toBe(afterUnconfirmed + 1);
    });
  });

  it('destroy() cancels the tracker and clears the in-flight set', async () => {
    const { store, accountsStore, tracker } = setup({ accounts: [account('acc-1', 1000)] });
    const cancelSpy = vi.spyOn(tracker, 'cancel');
    await accountsStore.load();
    await store.submit(req({ fromAccountId: 'acc-1' }));
    expect(store.canSubmitFrom('acc-1')).toBe(false);

    store.destroy();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(store.canSubmitFrom('acc-1')).toBe(true);
  });

  it('the state never carries Spanish text (only typed outcomes)', async () => {
    const { store, accountsStore, transfers } = setup({ accounts: [account('acc-1', 1000)] });
    await accountsStore.load();
    transfers.createError = { kind: 'insufficient-funds' };
    await store.submit(req({ fromAccountId: 'acc-1' }));
    const s = store.state();
    // A typed ApiError, not a string.
    if (s.status === 'idle') {
      expect(typeof s.lastError).toBe('object');
      expect(s.lastError).toEqual({ kind: 'insufficient-funds' });
    }
  });
});
