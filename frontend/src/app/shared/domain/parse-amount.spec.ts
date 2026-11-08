import { describe, it, expect } from 'vitest';
import { parseAmountInput } from './parse-amount';
import { Money } from './money';

const ARS = 'ARS';

/** Helper: expect an ok result whose money equals the given cents. */
function expectCents(text: string, cents: number): void {
  const r = parseAmountInput(text, ARS);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.money.equals(Money.fromMinor(cents, ARS))).toBe(true);
}

describe('parseAmountInput', () => {
  describe('accepted', () => {
    it('reads a comma as the decimal separator', () => expectCents('1234,56', 123456));
    it('reads a dot as the decimal separator', () => expectCents('1234.56', 123456));
    it('reads an integer (no decimals)', () => expectCents('1234', 123400));
    it('reads one decimal, padding to two', () => expectCents('12,5', 1250));
    it('reads the smallest positive amount', () => expectCents('0,01', 1));

    it('trims surrounding whitespace', () => expectCents('  1234,56 ', 123456));

    it('keeps full precision near the safe-integer ceiling', () => {
      // 90071992547408,99 -> exactly 9007199254740899 cents (<= MAX_SAFE_INTEGER).
      expectCents('90071992547408,99', 9007199254740899);
    });
  });

  describe('rejected', () => {
    const cases: [string, string][] = [
      ['0', 'not-positive'],
      ['0,00', 'not-positive'],
      ['-5', 'not-positive'],
      ['-0', 'not-positive'],
      ['abc', 'invalid-format'],
      ['1e3', 'invalid-format'],
      ['', 'empty'],
      ['   ', 'empty'],
      ['1.234', 'too-many-decimals'], // a dot is a decimal separator, never thousands
      ['1.234,56', 'invalid-format'], // two separators
      ['1,234.56', 'invalid-format'], // two separators
      ['12,345', 'too-many-decimals'],
      ['1234.', 'invalid-format'], // trailing separator, no decimals
      ['1 234,56', 'invalid-format'], // inner whitespace
      ['١٢٣', 'invalid-format'], // non-ASCII digits
      ['90071992547410', 'too-large'], // *100 overflows the safe integer range
      ['9'.repeat(400), 'too-large'], // Number(...) -> Infinity
    ];

    for (const [text, reason] of cases) {
      it(`rejects ${JSON.stringify(text.length > 20 ? text.slice(0, 10) + '…' : text)} as ${reason}`, () => {
        const r = parseAmountInput(text, ARS);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toBe(reason);
      });
    }
  });

  it('never throws for out-of-range input (returns too-large instead)', () => {
    expect(() => parseAmountInput('9'.repeat(400), ARS)).not.toThrow();
    expect(() => parseAmountInput('90071992547410', ARS)).not.toThrow();
  });
});
