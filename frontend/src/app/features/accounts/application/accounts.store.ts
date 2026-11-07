import { Injectable, computed, inject, signal } from '@angular/core';
import { AccountPort, type CreateAccountInput } from './account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { type Account } from '../../../shared/domain/account';
import { type Money } from '../../../shared/domain/money';
import {
  availableBalance,
  type AccountTransaction,
} from '../../../shared/domain/available-balance';

/** A row in the accounts list: the account plus its computed available balance. */
export interface AccountRow {
  account: Account;
  /** Available balance, or null when it could not be computed for this account. */
  available: Money | null;
  /** True when the account has outgoing pending transfers (shows the "in process" notice). */
  hasPending: boolean;
}

export type AccountsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | {
      status: 'ready';
      rows: AccountRow[];
      /** False when pending transfers could not be read (show ledger balance + notice). */
      pendingAvailable: boolean;
      /** True when a refresh failed and the shown data may be out of date. */
      stale: boolean;
    };

/**
 * Accounts store. Loads pending transfers first, then accounts, in sequence
 * (never Promise.all), so the available balance errs low and never enables an
 * overdraft. A generation counter makes a stale response never overwrite a newer
 * one; it is checked right after every await, before any state change.
 *
 * Uses signals and inject (allowed in application); no browser, HTTP or Router.
 */
@Injectable({ providedIn: 'root' })
export class AccountsStore {
  private readonly accounts = inject(AccountPort);
  private readonly pending = inject(PendingTransfersPort);

  private readonly stateSig = signal<AccountsState>({ status: 'loading' });
  private readonly refreshingSig = signal(false);
  private generation = 0;

  readonly state = this.stateSig.asReadonly();
  readonly refreshing = this.refreshingSig.asReadonly();
  readonly isReady = computed(() => this.stateSig().status === 'ready');

  /** Whether there is data currently shown (ready state). */
  private hasData(): boolean {
    return this.stateSig().status === 'ready';
  }

  /** In-flight load promise, used to make ensureLoaded idempotent. */
  private inFlight: Promise<void> | null = null;

  /** First load (or retry from an error): shows the loading panel if there is no data. */
  load(): Promise<void> {
    return this.run(false);
  }

  /**
   * Ensures the accounts list is loaded. Idempotent: if a load is in flight it
   * returns the same promise (no second load); if the last load ended in error,
   * it retries; if data is already present, it is a no-op.
   */
  ensureLoaded(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }
    if (this.stateSig().status === 'ready') {
      return Promise.resolve();
    }
    return this.load();
  }

  /** The row for an account id, or undefined if not present. */
  rowById(id: string): AccountRow | undefined {
    const s = this.stateSig();
    return s.status === 'ready' ? s.rows.find((r) => r.account.id === id) : undefined;
  }

  /** Refresh: keeps the current data visible with an indicator. */
  refresh(): Promise<void> {
    return this.run(true);
  }

  /**
   * Creates an account and then refreshes the list. Returns whether the refresh
   * after a successful create also succeeded, so the UI can show a specific
   * message ("created, but we couldn't refresh the list"). A create failure
   * rejects (the dialog shows the error and stays open).
   */
  async create(input: CreateAccountInput): Promise<{ refreshed: boolean }> {
    await this.accounts.create(input); // may reject: dialog handles it
    await this.refresh();
    // refresh() never rejects; it marks the state stale when the reload failed.
    const s = this.stateSig();
    const refreshed = !(s.status === 'ready' && s.stale);
    return { refreshed };
  }

  private run(isRefresh: boolean): Promise<void> {
    const p = this.runInner(isRefresh).finally(() => {
      if (this.inFlight === p) {
        this.inFlight = null;
      }
    });
    this.inFlight = p;
    return p;
  }

  private async runInner(isRefresh: boolean): Promise<void> {
    const gen = ++this.generation;

    if (isRefresh && this.hasData()) {
      this.refreshingSig.set(true);
    } else {
      this.stateSig.set({ status: 'loading' });
    }

    // 1) Pending first (sequential). A failure here is not fatal.
    let pendings: AccountTransaction[] = [];
    let pendingOk = true;
    try {
      pendings = await this.pending.pendingOutgoing();
    } catch {
      pendingOk = false;
    }
    if (gen !== this.generation) return; // a newer load started: discard

    // 2) Accounts after. A failure here is fatal only without existing data.
    let accounts: Account[];
    try {
      accounts = await this.accounts.list();
    } catch {
      if (gen !== this.generation) return; // check before any state change
      if (this.hasData()) {
        this.markStale();
      } else {
        this.stateSig.set({ status: 'error' });
      }
      this.stopRefreshing(gen);
      return;
    }
    if (gen !== this.generation) return; // check before any state change

    if (accounts.length === 0) {
      this.stateSig.set({ status: 'empty' });
      this.stopRefreshing(gen);
      return;
    }

    // Build all rows at once from the SAME read (never mix reads).
    const rows = accounts.map((account) => this.toRow(account, pendings, pendingOk));
    this.stateSig.set({ status: 'ready', rows, pendingAvailable: pendingOk, stale: false });
    this.stopRefreshing(gen);
  }

  private toRow(account: Account, pendings: AccountTransaction[], pendingOk: boolean): AccountRow {
    if (!pendingOk) {
      return { account, available: null, hasPending: false };
    }
    const hasPending = pendings.some(
      (t) => t.accountId === account.id && t.direction === 'out' && t.status === 'pending',
    );
    let available: Money | null;
    try {
      available = availableBalance(account.balance, account.id, pendings);
    } catch {
      // Corrupt data (e.g. a pending in another currency): degrade this row only.
      available = null;
    }
    return { account, available, hasPending };
  }

  private markStale(): void {
    const s = this.stateSig();
    if (s.status === 'ready') {
      this.stateSig.set({ ...s, stale: true });
    }
  }

  /** Only the latest generation turns the refresh indicator off. */
  private stopRefreshing(gen: number): void {
    if (gen === this.generation) {
      this.refreshingSig.set(false);
    }
  }
}
