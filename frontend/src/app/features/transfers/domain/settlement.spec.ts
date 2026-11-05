import { describe, it, expect } from 'vitest';
import {
  nextSettlementStep,
  DEFAULT_SETTLEMENT_CONFIG,
  type SettlementConfig,
} from './settlement';

const config: SettlementConfig = { maxAttempts: 6, intervalMs: 1000 };

describe('nextSettlementStep', () => {
  describe('terminal statuses', () => {
    it('confirms when the transfer is completed', () => {
      expect(nextSettlementStep('completed', 1, config)).toBe('confirmed');
    });

    it('fails when the transfer is failed', () => {
      expect(nextSettlementStep('failed', 1, config)).toBe('failed');
    });
  });

  describe('pending', () => {
    it('retries while attempts remain', () => {
      expect(nextSettlementStep('pending', 1, config)).toBe('retry');
    });

    it('ends as unconfirmed when attempts are exhausted', () => {
      expect(nextSettlementStep('pending', 6, config)).toBe('unconfirmed');
    });
  });

  // Case A: exact off-by-one boundary of exhaustion.
  describe('exhaustion boundary (case A)', () => {
    it('retries on the attempt just before the max', () => {
      expect(nextSettlementStep('pending', config.maxAttempts - 1, config)).toBe('retry');
    });

    it('is unconfirmed exactly at the max attempt', () => {
      expect(nextSettlementStep('pending', config.maxAttempts, config)).toBe('unconfirmed');
    });

    it('stays unconfirmed past the max attempt', () => {
      expect(nextSettlementStep('pending', config.maxAttempts + 1, config)).toBe('unconfirmed');
    });
  });

  // Case B: a terminal status wins even when attempts are exhausted.
  describe('terminal status wins over exhaustion (case B)', () => {
    it('confirms on the last attempt when completed arrives', () => {
      expect(nextSettlementStep('completed', config.maxAttempts, config)).toBe('confirmed');
    });

    it('fails on the last attempt when failed arrives', () => {
      expect(nextSettlementStep('failed', config.maxAttempts, config)).toBe('failed');
    });
  });

  // Case C: minimal valid config of a single attempt.
  describe('single-attempt config (case C)', () => {
    const single: SettlementConfig = { maxAttempts: 1, intervalMs: 1000 };

    it('is unconfirmed after the only attempt when still pending', () => {
      expect(nextSettlementStep('pending', 1, single)).toBe('unconfirmed');
    });

    it('still confirms on the only attempt when completed', () => {
      expect(nextSettlementStep('completed', 1, single)).toBe('confirmed');
    });
  });

  // A failed poll request (network / 500) is not a transfer failure.
  describe('unknown status (poll request failed)', () => {
    it('retries like pending while attempts remain', () => {
      expect(nextSettlementStep('unknown', 1, config)).toBe('retry');
    });

    it('ends as unconfirmed (not failed) when attempts are exhausted', () => {
      expect(nextSettlementStep('unknown', config.maxAttempts, config)).toBe('unconfirmed');
    });

    it('retries on the attempt just before the max', () => {
      expect(nextSettlementStep('unknown', config.maxAttempts - 1, config)).toBe('retry');
    });
  });

  describe('DEFAULT_SETTLEMENT_CONFIG', () => {
    it('polls every second up to 6 attempts', () => {
      expect(DEFAULT_SETTLEMENT_CONFIG).toEqual({ maxAttempts: 6, intervalMs: 1000 });
    });
  });
});
