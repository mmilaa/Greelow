import { describe, it, expect } from 'vitest';
import { formatDateTime } from './format-date';
import { InvalidDataError } from './errors';

// Normalize non-breaking and narrow spaces that Intl may emit, to compare text.
function norm(s: string): string {
  return s.replace(/\u00a0|\u202f/g, ' ');
}

describe('formatDateTime', () => {
  it('formats in UTC: 5 nov 2026, 2:00 a. m.', () => {
    const out = norm(formatDateTime('2026-11-05T02:00:00Z', 'UTC'));
    expect(out).toMatch(/5 nov 2026.*\b2:00 a\. m\./);
  });

  it('shifts to the previous day in Buenos Aires: 4 nov 2026, 11:00 p. m.', () => {
    const out = norm(formatDateTime('2026-11-05T02:00:00Z', 'America/Argentina/Buenos_Aires'));
    expect(out).toMatch(/4 nov 2026.*\b11:00 p\. m\./);
  });

  it('throws InvalidDataError on invalid or zone-less input', () => {
    expect(() => formatDateTime('not-a-date')).toThrow(InvalidDataError);
    expect(() => formatDateTime('')).toThrow(InvalidDataError);
    expect(() => formatDateTime('2026-11-05T02:00:00')).toThrow(InvalidDataError);
  });
});
