import { describe, it, expect } from 'vitest';
import { isValidIsoDateTime } from './iso-date';

describe('isValidIsoDateTime', () => {
  it('accepts ISO with Z, with milliseconds and with an offset', () => {
    expect(isValidIsoDateTime('2026-11-05T02:00:00Z')).toBe(true);
    expect(isValidIsoDateTime('2026-11-05T02:00:00.123Z')).toBe(true);
    expect(isValidIsoDateTime('2026-11-05T02:00:00-03:00')).toBe(true);
  });

  it('rejects a zone-less string (ambiguous local time)', () => {
    expect(isValidIsoDateTime('2026-11-05T02:00:00')).toBe(false);
  });

  it('rejects loose inputs Date.parse would otherwise accept', () => {
    expect(isValidIsoDateTime('1')).toBe(false);
    expect(isValidIsoDateTime('2026')).toBe(false);
    expect(isValidIsoDateTime('March 7, 2026')).toBe(false);
    expect(isValidIsoDateTime('')).toBe(false);
  });

  describe('calendar validity by components (Date.parse would roll these over)', () => {
    it('rejects an impossible day for the month', () => {
      expect(isValidIsoDateTime('2026-02-30T10:00:00Z')).toBe(false);
      expect(isValidIsoDateTime('2026-04-31T10:00:00Z')).toBe(false);
    });

    it('rejects 29 Feb on a non-leap year', () => {
      expect(isValidIsoDateTime('2026-02-29T10:00:00Z')).toBe(false);
    });

    it('accepts 29 Feb on a leap year', () => {
      expect(isValidIsoDateTime('2028-02-29T10:00:00Z')).toBe(true);
    });

    it('rejects an out-of-range month, hour, minute or second', () => {
      expect(isValidIsoDateTime('2026-13-01T10:00:00Z')).toBe(false);
      expect(isValidIsoDateTime('2026-11-05T24:00:00Z')).toBe(false);
      expect(isValidIsoDateTime('2026-11-05T10:60:00Z')).toBe(false);
      expect(isValidIsoDateTime('2026-11-05T10:00:60Z')).toBe(false);
    });
  });
});
