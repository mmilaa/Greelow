import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TransferTracker } from './transfer-tracker';
import { TransferPort, type CreateTransferInput } from './transfer.port';
import { type Transfer } from '../domain/transfer';
import { type TransactionStatus } from '../../../shared/domain/transaction';
import { ApiErrorException, type ApiError } from '../../../shared/domain/map-api-error';
import { DEFAULT_SETTLEMENT_CONFIG } from '../domain/settlement';

/**
 * A TransferPort fake that returns a scripted status per getById call, or throws
 * a scripted error. Counts getById calls.
 */
class FakeTransferPort extends TransferPort {
  getByIdCalls = 0;
  /** A queue of outcomes consumed in order; the last one repeats if exhausted. */
  script: Array<TransactionStatus | { throw: ApiError }> = [];

  override async create(_input: CreateTransferInput): Promise<Transfer> {
    throw new Error('not used in tracker tests');
  }

  override async getById(id: string): Promise<Transfer> {
    const i = Math.min(this.getByIdCalls, this.script.length - 1);
    this.getByIdCalls += 1;
    const step = this.script[i];
    if (typeof step === 'object' && 'throw' in step) {
      throw new ApiErrorException(step.throw);
    }
    return { id, status: step as TransactionStatus, from: null, to: { } as never };
  }
}

function setup(script: FakeTransferPort['script']) {
  const port = new FakeTransferPort();
  port.script = script;
  TestBed.configureTestingModule({
    providers: [TransferTracker, { provide: TransferPort, useValue: port }],
  });
  return { tracker: TestBed.inject(TransferTracker), port };
}

const INTERVAL = DEFAULT_SETTLEMENT_CONFIG.intervalMs;

describe('TransferTracker', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not poll at t=0: the first getById lands after one interval', async () => {
    const { tracker, port } = setup(['completed']);
    const done = tracker.start('t-1');

    expect(port.getByIdCalls).toBe(0); // POST already said pending; no immediate poll
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(port.getByIdCalls).toBe(1);
    await expect(done).resolves.toBe('confirmed');
  });

  it('confirms on the second attempt (pending then completed)', async () => {
    const { tracker, port } = setup(['pending', 'completed']);
    const done = tracker.start('t-1');

    await vi.advanceTimersByTimeAsync(INTERVAL); // attempt 1 -> pending -> retry
    expect(port.getByIdCalls).toBe(1);
    await vi.advanceTimersByTimeAsync(INTERVAL); // attempt 2 -> completed -> confirmed
    expect(port.getByIdCalls).toBe(2);
    await expect(done).resolves.toBe('confirmed');
    expect(tracker.state()).toEqual({ phase: 'done', outcome: 'confirmed', attempt: 2 });
  });

  it('ends as failed when the transfer status is failed', async () => {
    const { tracker, port } = setup(['pending', 'failed']);
    const done = tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);
    expect(port.getByIdCalls).toBe(2);
    await expect(done).resolves.toBe('failed');
  });

  it('exhausts 6 attempts of pending and ends unconfirmed', async () => {
    const { tracker, port } = setup(['pending']); // repeats
    const done = tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL * 6);
    expect(port.getByIdCalls).toBe(6);
    await expect(done).resolves.toBe('unconfirmed');
    // No further timer is scheduled after exhaustion.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a failing poll (network/500/invalid) counts as unknown, not failed, and retries', async () => {
    // Two throws, then completed: the throws are "unknown" (retry), not a failure.
    const { tracker, port } = setup([
      { throw: { kind: 'network' } },
      { throw: { kind: 'unknown', status: 500 } },
      'completed',
    ]);
    const done = tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(port.getByIdCalls).toBe(3);
    await expect(done).resolves.toBe('confirmed');
  });

  it('an invalid-response poll also counts as unknown and keeps trying', async () => {
    const { tracker, port } = setup([{ throw: { kind: 'invalid-response' } }, 'completed']);
    const done = tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);
    expect(port.getByIdCalls).toBe(2);
    await expect(done).resolves.toBe('confirmed');
  });

  it('unauthenticated stops tracking immediately', async () => {
    const { tracker, port } = setup([{ throw: { kind: 'unauthenticated' } }]);
    const done = tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(port.getByIdCalls).toBe(1);
    await expect(done).resolves.toBe('unauthenticated');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancel() leaves no timers and no further polls', async () => {
    const { tracker, port } = setup(['pending']);
    tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL); // one poll, then schedules another
    expect(port.getByIdCalls).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    tracker.cancel();
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(INTERVAL * 10);
    expect(port.getByIdCalls).toBe(1); // no more polls after cancel
  });

  it('a poll in flight when cancel() runs changes nothing', async () => {
    const port = new FakeTransferPort();
    let resolveGet!: (t: Transfer) => void;
    vi.spyOn(port, 'getById').mockImplementation(
      () => new Promise<Transfer>((r) => (resolveGet = r)),
    );
    TestBed.configureTestingModule({
      providers: [TransferTracker, { provide: TransferPort, useValue: port }],
    });
    const tracker = TestBed.inject(TransferTracker);
    tracker.start('t-1');
    await vi.advanceTimersByTimeAsync(INTERVAL); // poll starts, hangs

    const before = tracker.state();
    tracker.cancel();
    resolveGet({ id: 't-1', status: 'completed', from: null, to: {} as never });
    await Promise.resolve();

    // Cancelled generation: the resolved poll is discarded. cancel() does not
    // reset the state (the screen is being destroyed), but it schedules nothing
    // and the outcome is never applied, so the state is unchanged from before.
    expect(tracker.state()).toEqual(before);
    expect(tracker.state().phase).not.toBe('done');
    expect(vi.getTimerCount()).toBe(0);
  });

  describe('verifyAgain (one extra poll)', () => {
    it('confirms when the extra poll returns completed', async () => {
      const { tracker, port } = setup(['pending']); // 6 pendings -> unconfirmed
      const done = tracker.start('t-1');
      await vi.advanceTimersByTimeAsync(INTERVAL * 6);
      await expect(done).resolves.toBe('unconfirmed');
      expect(port.getByIdCalls).toBe(6);

      // Now the transfer completes; one extra immediate poll confirms it.
      port.script = ['completed'];
      port.getByIdCalls = 0;
      const outcome = await tracker.verifyAgain();
      expect(port.getByIdCalls).toBe(1);
      expect(outcome).toBe('confirmed');
    });

    it('returns to unconfirmed when the extra poll is still pending', async () => {
      const { tracker, port } = setup(['pending']);
      const done = tracker.start('t-1');
      await vi.advanceTimersByTimeAsync(INTERVAL * 6);
      await expect(done).resolves.toBe('unconfirmed');
      port.getByIdCalls = 0;
      const outcome = await tracker.verifyAgain();
      expect(port.getByIdCalls).toBe(1);
      expect(outcome).toBe('unconfirmed');
    });

    it('a repeated click while verifying does not run a second poll', async () => {
      const port = new FakeTransferPort();
      // First phase: six pendings via fake timers.
      port.script = ['pending'];
      TestBed.configureTestingModule({
        providers: [TransferTracker, { provide: TransferPort, useValue: port }],
      });
      const tracker = TestBed.inject(TransferTracker);
      const done = tracker.start('t-1');
      await vi.advanceTimersByTimeAsync(INTERVAL * 6);
      await expect(done).resolves.toBe('unconfirmed');

      // Make the verification poll hang so a second click sees "tracking".
      let resolveGet!: (t: Transfer) => void;
      vi.spyOn(port, 'getById').mockImplementation(
        () => new Promise<Transfer>((r) => (resolveGet = r)),
      );
      const first = tracker.verifyAgain();
      const second = await tracker.verifyAgain(); // guard: not in unconfirmed state
      expect(second).toBe('unconfirmed');

      resolveGet({ id: 't-1', status: 'completed', from: null, to: {} as never });
      await expect(first).resolves.toBe('confirmed');
    });
  });
});
