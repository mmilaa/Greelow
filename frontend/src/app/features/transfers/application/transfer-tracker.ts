import { Injectable, inject, signal } from '@angular/core';
import { TransferPort } from './transfer.port';
import { ApiErrorException } from '../../../shared/domain/map-api-error';
import {
  nextSettlementStep,
  DEFAULT_SETTLEMENT_CONFIG,
  type SettlementConfig,
  type TransferStatus,
} from '../domain/settlement';

/**
 * Polls a transfer until it settles, owning the timers (the domain decides, the
 * application schedules). No RxJS: a single setTimeout chain, so the first poll
 * lands one interval after the POST (which already returned `pending`), never at
 * t=0.
 *
 * A generation counter cancels cleanly: a poll already in flight when cancel()
 * runs resolves into a discarded generation and changes nothing, and no new
 * timer is scheduled. The screen provides this in its own providers and cancels
 * it on destroy (DestroyRef), so leaving the page leaves no timers.
 *
 * Uses signals and inject (allowed in application). The only browser API is
 * setTimeout/clearTimeout, which is the scheduling this layer is responsible for.
 */

/** Terminal outcome of tracking a transfer. */
export type TrackOutcome = 'confirmed' | 'failed' | 'unconfirmed' | 'unauthenticated';

/** Live tracking state, exposed as a signal for the screen. */
export type TrackState =
  | { phase: 'idle' }
  | { phase: 'tracking'; attempt: number }
  | { phase: 'done'; outcome: TrackOutcome; attempt: number };

@Injectable()
export class TransferTracker {
  private readonly transfers = inject(TransferPort);

  private readonly stateSig = signal<TrackState>({ phase: 'idle' });
  readonly state = this.stateSig.asReadonly();

  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private transferId: string | null = null;
  private config: SettlementConfig = DEFAULT_SETTLEMENT_CONFIG;
  private attempt = 0;
  private resolveDone: ((outcome: TrackOutcome) => void) | null = null;

  /**
   * Starts tracking `transferId`. Resolves with the terminal outcome. The first
   * poll is scheduled after `config.intervalMs`; the POST already told us it is
   * pending, so we do not poll immediately.
   */
  start(transferId: string, config: SettlementConfig = DEFAULT_SETTLEMENT_CONFIG): Promise<TrackOutcome> {
    this.cancel();
    const gen = this.generation;
    this.transferId = transferId;
    this.config = config;
    this.attempt = 0;
    this.stateSig.set({ phase: 'tracking', attempt: 0 });
    return new Promise<TrackOutcome>((resolve) => {
      this.resolveDone = resolve;
      this.scheduleNext(gen);
    });
  }

  /**
   * Runs exactly one extra poll from the `unconfirmed` state ("Verificar de
   * nuevo"): a single immediate read, not a fresh 6-attempt cycle. A guard keeps
   * repeated clicks from running two polls at once. If still pending, it returns
   * to `unconfirmed`.
   */
  async verifyAgain(): Promise<TrackOutcome> {
    const s = this.stateSig();
    if (s.phase !== 'done' || s.outcome !== 'unconfirmed') {
      // Not in a verifiable state (or a verification is already running).
      return s.phase === 'done' ? s.outcome : 'unconfirmed';
    }
    if (this.transferId === null) {
      return 'unconfirmed';
    }
    const gen = this.generation;
    // Mark tracking so a second click sees a non-verifiable state and no-ops.
    this.stateSig.set({ phase: 'tracking', attempt: this.attempt });
    const status = await this.pollOnce(this.transferId);
    if (gen !== this.generation) {
      return 'unconfirmed'; // cancelled meanwhile: discard
    }
    if (status === 'unauthenticated') {
      return this.settle('unauthenticated');
    }
    // One extra observed poll; attempts stay at max, so a non-terminal status
    // maps back to unconfirmed via nextSettlementStep.
    const step = nextSettlementStep(status, this.config.maxAttempts, this.config);
    if (step === 'confirmed') return this.settle('confirmed');
    if (step === 'failed') return this.settle('failed');
    return this.settle('unconfirmed');
  }

  /** Cancels any scheduled poll. Safe to call repeatedly and on destroy. */
  cancel(): void {
    this.generation += 1;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // A pending start() promise is intentionally left unresolved: the caller
    // discards it (the screen is being destroyed).
    this.resolveDone = null;
  }

  private scheduleNext(gen: number): void {
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick(gen);
    }, this.config.intervalMs);
  }

  private async tick(gen: number): Promise<void> {
    if (gen !== this.generation || this.transferId === null) {
      return; // cancelled before the timer fired
    }
    const status = await this.pollOnce(this.transferId);
    if (gen !== this.generation) {
      return; // cancelled while the request was in flight
    }

    if (status === 'unauthenticated') {
      this.settle('unauthenticated');
      return;
    }

    this.attempt += 1;
    this.stateSig.set({ phase: 'tracking', attempt: this.attempt });

    const step = nextSettlementStep(status, this.attempt, this.config);
    switch (step) {
      case 'confirmed':
        this.settle('confirmed');
        return;
      case 'failed':
        this.settle('failed');
        return;
      case 'unconfirmed':
        this.settle('unconfirmed');
        return;
      case 'retry':
        this.scheduleNext(gen);
        return;
    }
  }

  /**
   * Reads the transfer status once. A request failure (network, 5xx, invalid
   * response) is NOT a transfer outcome: it maps to `unknown`, which settlement
   * treats like pending. A 401 is distinct: it means the session died, so we
   * surface `unauthenticated` to stop tracking.
   */
  private async pollOnce(id: string): Promise<TransferStatus | 'unauthenticated'> {
    try {
      const transfer = await this.transfers.getById(id);
      return transfer.status;
    } catch (err) {
      if (err instanceof ApiErrorException && err.error.kind === 'unauthenticated') {
        return 'unauthenticated';
      }
      return 'unknown';
    }
  }

  private settle(outcome: TrackOutcome): TrackOutcome {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stateSig.set({ phase: 'done', outcome, attempt: this.attempt });
    const resolve = this.resolveDone;
    this.resolveDone = null;
    resolve?.(outcome);
    return outcome;
  }
}
