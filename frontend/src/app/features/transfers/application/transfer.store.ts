import { Injectable, computed, inject, signal } from '@angular/core';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { type Money } from '../../../shared/domain/money';
import { type Transaction } from '../../../shared/domain/transaction';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { type ApiError, ApiErrorException } from '../../../shared/domain/map-api-error';
import { TransferPort } from './transfer.port';
import { TransferTracker, type TrackOutcome } from './transfer-tracker';
import {
  canTransfer,
  type TransferBlockReason,
  type TransferDestination,
} from '../domain/transfer-policy';

/**
 * Transfer store: validates, submits and follows a single transfer, keeping the
 * state machine for the screen. No RxJS. The timers live in TransferTracker.
 *
 * Provided in the screen component (not root), together with TransferTracker,
 * so leaving the page destroys both and cancels timers (the screen wires
 * DestroyRef -> store.destroy()). The per-source block lives here.
 *
 * Business rules are not re-implemented here: funds are decided by canTransfer
 * (the single authority), the fresh read reuses AccountsStore.refresh() (pending
 * first, then accounts, in sequence), and settlement is decided by the domain
 * via the tracker.
 */

/** Why a transfer could not proceed: the policy reasons plus the store's own. */
export type BlockReason =
  | TransferBlockReason
  | 'available-unknown'
  | 'in-flight-from-account';

/** A transfer request from the screen. The amount is already parsed Money. */
export interface TransferRequest {
  fromAccountId: string;
  /** Destination: an own account (currency known) or external (unknown currency). */
  destination: TransferDestination;
  amount: Money;
  description?: string;
}

/** What we managed to read after an uncertain create, for the user to decide. */
export interface VerificationResult {
  /** Outgoing transfer legs of the source account found in the recent list. */
  recentOutgoing: Transaction[];
  /** Outgoing pending transfers of the source account. */
  outgoingPending: AccountTransaction[];
  /** True when the verification read itself failed (show the notice, still allow exit). */
  readFailed: boolean;
}

/**
 * Store state. Never holds Spanish text: it exposes typed outcomes (block
 * reasons, ApiError) and the UI catalog turns them into text.
 *
 * - idle: ready to submit. `lastError` carries a KNOWN create error (400/404/
 *   422/401) as a typed ApiError, so the UI shows the catalog message.
 * - uncertain: the create result is unknown.
 *   - kind 'network': may or may not have been created -> retry allowed once
 *     verification finishes (even if verification failed, with a notice).
 *   - kind 'invalid-response': the server accepted it but we have no id ->
 *     retry is NOT offered (would duplicate); only "view account" / "new transfer".
 */
export type TransferState =
  | { status: 'idle'; lastError: ApiError | null }
  | { status: 'validating' }
  | { status: 'blocked'; reason: BlockReason; available: Money | null }
  | { status: 'submitting' }
  | { status: 'tracking'; attempt: number; transferId: string }
  | { status: 'confirmed' }
  | { status: 'failed' }
  | { status: 'unconfirmed' }
  | {
      status: 'uncertain';
      kind: 'network' | 'invalid-response';
      verifying: boolean;
      verification: VerificationResult | null;
    };

@Injectable()
export class TransferStore {
  private readonly accountsStore = inject(AccountsStore);
  private readonly transfers = inject(TransferPort);
  private readonly transactions = inject(TransactionPort);
  private readonly pendingPort = inject(PendingTransfersPort);
  private readonly tracker = inject(TransferTracker);

  private readonly stateSig = signal<TransferState>({ status: 'idle', lastError: null });
  readonly state = this.stateSig.asReadonly();

  /** The tracker's live state (attempt number, outcome), for the screen. */
  readonly trackState = this.tracker.state;

  /**
   * Source account ids with a transfer currently in flight (tracking). A new
   * transfer from such an account is blocked; from another account it is not.
   */
  private readonly inFlightSig = signal<ReadonlySet<string>>(new Set());

  /** Whether a new transfer may start from the given source account. */
  canSubmitFrom(accountId: string): boolean {
    return !this.inFlightSig().has(accountId);
  }

  readonly isBusy = computed(() => {
    const s = this.stateSig().status;
    return s === 'validating' || s === 'submitting' || s === 'tracking';
  });

  /**
   * The one public entry point. Synchronous guard first: if not idle, returns
   * immediately (so a double click never fires two creates). Then validating ->
   * fresh read -> canTransfer -> submitting -> create, and on success tracking.
   */
  async submit(request: TransferRequest): Promise<void> {
    // Synchronous guard against double submit / submitting while busy.
    if (this.stateSig().status !== 'idle') {
      return;
    }
    // Per-source block: another transfer is already in flight from this account.
    if (!this.canSubmitFrom(request.fromAccountId)) {
      this.block('in-flight-from-account', null);
      return;
    }

    this.stateSig.set({ status: 'validating' });

    // Fresh read: reuse AccountsStore.refresh() (pending first, then accounts,
    // in sequence; never rejects). The card's available and the validation's
    // available come from this same read.
    //
    // A refresh can be SUPERSEDED by a newer load (another screen, the user
    // hitting "Actualizar"): its await resolves but the state still shows the
    // OLDER data until the newer load finishes. Validating then would read data
    // that did not come from a read AFTER this submit. So we require the store's
    // applied-data generation to advance past what it was before our read; if it
    // did not, we retry the read ONCE, and if it still did not, we block. We
    // never validate with data older than the read we asked for.
    if (!(await this.freshReadApplied())) {
      this.block('available-unknown', null);
      return;
    }

    const s = this.accountsStore.state();
    if (s.status !== 'ready' || s.stale || !s.pendingAvailable) {
      this.block('available-unknown', null);
      return;
    }
    const row = s.rows.find((r) => r.account.id === request.fromAccountId);
    if (row === undefined || row.available === null) {
      this.block('available-unknown', null);
      return;
    }

    // canTransfer is the single authority on funds; feed it the raw pendings
    // from the very same read.
    const source = row.account;
    const check = canTransfer({
      source: { accountId: source.id, currency: source.currency, balance: source.balance },
      destination: request.destination,
      amount: request.amount,
      transactions: s.pendings,
    });
    if (!check.allowed) {
      this.block(check.reason, row.available);
      return;
    }

    await this.create(request);
  }

  /** From `unconfirmed`, run one extra verification poll ("Verificar de nuevo"). */
  async verifyAgain(): Promise<void> {
    if (this.stateSig().status !== 'unconfirmed') {
      return;
    }
    const outcome = await this.tracker.verifyAgain();
    this.applyOutcome(outcome);
  }

  /**
   * "Intentar de nuevo" after a network-uncertain create. Only valid for the
   * network kind and once verification has finished; invalid-response never
   * retries (it would duplicate). Returns to idle so submit() can run again.
   */
  retryAfterNetwork(): void {
    const s = this.stateSig();
    if (s.status === 'uncertain' && s.kind === 'network' && !s.verifying) {
      this.stateSig.set({ status: 'idle', lastError: null });
    }
  }

  /** "Hacer otra transferencia": clear state back to idle (the form resets). */
  reset(): void {
    if (this.isBusy()) {
      return;
    }
    this.stateSig.set({ status: 'idle', lastError: null });
  }

  /** Cancels timers. The screen calls this on destroy (DestroyRef). */
  destroy(): void {
    this.tracker.cancel();
    this.inFlightSig.set(new Set());
  }

  private async create(request: TransferRequest): Promise<void> {
    this.stateSig.set({ status: 'submitting' });
    try {
      const transfer = await this.transfers.create({
        fromAccountId: request.fromAccountId,
        toAccountId: request.destination.accountId,
        amount: request.amount,
        description: request.description,
      });
      this.startTracking(request.fromAccountId, transfer.id);
    } catch (err) {
      this.handleCreateError(err, request);
    }
  }

  private handleCreateError(err: unknown, request: TransferRequest): void {
    if (!(err instanceof ApiErrorException)) {
      // Not a classified API error: treat as an unexpected unknown, uncertain.
      this.enterUncertain('network', request);
      return;
    }
    const kind = err.error.kind;
    // network: the server may or may not have created it -> uncertain, verify.
    if (kind === 'network') {
      this.enterUncertain('network', request);
      return;
    }
    // invalid-response: 2xx body we could not read -> the server ACCEPTED it.
    // Retrying would duplicate money, so no retry; verify and show.
    if (kind === 'invalid-response') {
      this.enterUncertain('invalid-response', request);
      return;
    }
    // Known rejections (400 validation, 400 same-account, 404 not-found,
    // 422 insufficient-funds, 401 unauthenticated). The server rejected it:
    // not uncertain, no tracking, back to idle with the typed error. A 401
    // expires the session on its own (runRequest fired ON_UNAUTHENTICATED).
    this.stateSig.set({ status: 'idle', lastError: err.error });
  }

  private startTracking(fromAccountId: string, transferId: string): void {
    this.addInFlight(fromAccountId);
    this.stateSig.set({ status: 'tracking', attempt: 0, transferId });
    void this.tracker.start(transferId).then((outcome) => {
      this.removeInFlight(fromAccountId);
      this.applyOutcome(outcome);
    });
  }

  private applyOutcome(outcome: TrackOutcome): void {
    switch (outcome) {
      case 'confirmed':
        this.stateSig.set({ status: 'confirmed' });
        // Refresh once: the pending clears and the available changes.
        void this.accountsStore.refresh();
        return;
      case 'failed':
        this.stateSig.set({ status: 'failed' });
        // Refresh once too: the failed pending disappears and the available changes.
        void this.accountsStore.refresh();
        return;
      case 'unconfirmed':
        this.stateSig.set({ status: 'unconfirmed' });
        return;
      case 'unauthenticated':
        // The session expires and redirects on its own; just stop here.
        this.stateSig.set({ status: 'idle', lastError: { kind: 'unauthenticated' } });
        return;
    }
  }

  /**
   * Enters the uncertain state and runs a verification read: the source
   * account's outgoing pending transfers and its most recent transfer legs, so
   * the user can decide. pendingOutgoing has no accountId filter, so we filter
   * by source in the client; the transfer list brings both legs, so we keep
   * direction 'out'. No automatic matching: just show the list.
   */
  private enterUncertain(kind: 'network' | 'invalid-response', request: TransferRequest): void {
    this.stateSig.set({ status: 'uncertain', kind, verifying: true, verification: null });
    void this.runVerification(request.fromAccountId).then((verification) => {
      const s = this.stateSig();
      // Only apply if we are still in the same uncertain state (not cancelled).
      if (s.status === 'uncertain') {
        this.stateSig.set({ ...s, verifying: false, verification });
      }
    });
  }

  private async runVerification(fromAccountId: string): Promise<VerificationResult> {
    let outgoingPending: AccountTransaction[] = [];
    let recentOutgoing: Transaction[] = [];
    let readFailed = false;

    // Sequential, not Promise.all. pendingOutgoing has no accountId filter, so
    // we filter by the source account in the client.
    try {
      const pendings = await this.pendingPort.pendingOutgoing();
      outgoingPending = pendings.filter((t) => t.accountId === fromAccountId);
    } catch {
      readFailed = true;
    }

    // The transfer list brings both legs; keep the outgoing one.
    try {
      const page = await this.transactions.list({
        accountId: fromAccountId,
        type: 'transfer',
        page: 1,
        pageSize: 5,
      });
      recentOutgoing = page.items.filter((t) => t.direction === 'out');
    } catch {
      readFailed = true;
    }

    return { recentOutgoing, outgoingPending, readFailed };
  }

  /**
   * Runs a fresh read (refresh) and returns whether THIS read is the one that
   * produced the current state: the store's applied-data generation must have
   * advanced past what it was before the read. If a newer load superseded ours,
   * we try once more; still superseded -> false (the caller blocks). This is the
   * guard against validating with stale data left in place by a superseded read.
   */
  private async freshReadApplied(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const before = this.accountsStore.dataGeneration();
      await this.accountsStore.refresh();
      if (this.accountsStore.dataGeneration() > before) {
        return true; // our read (or a newer applied one) is in place
      }
    }
    return false;
  }

  private block(reason: BlockReason, available: Money | null): void {
    this.stateSig.set({ status: 'blocked', reason, available });
  }

  private addInFlight(accountId: string): void {
    const next = new Set(this.inFlightSig());
    next.add(accountId);
    this.inFlightSig.set(next);
  }

  private removeInFlight(accountId: string): void {
    const next = new Set(this.inFlightSig());
    next.delete(accountId);
    this.inFlightSig.set(next);
  }
}
