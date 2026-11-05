import { describe, it, expect } from 'vitest';
import { Money } from './money';
import { CurrencyMismatchError } from './errors';

describe('Money', () => {
  describe('construction from a decimal amount', () => {
    it('stores the value as integer minor units', () => {
      const m = Money.fromDecimal(12.34, 'ARS');
      expect(m.amountMinor).toBe(1234);
      expect(m.currency).toBe('ARS');
    });

    it('rounds to the nearest minor unit (half up)', () => {
      expect(Money.fromDecimal(0.005, 'USD').amountMinor).toBe(1);
      expect(Money.fromDecimal(0.004, 'USD').amountMinor).toBe(0);
      expect(Money.fromDecimal(1.235, 'USD').amountMinor).toBe(124);
    });

    it('avoids binary floating point drift', () => {
      // 0.1 + 0.2 === 0.30000000000000004 as a float; via minor units it must be exact.
      expect(Money.fromDecimal(0.1 + 0.2, 'EUR').amountMinor).toBe(30);
    });

    it('supports negative amounts (accounts may go negative)', () => {
      const m = Money.fromDecimal(-169796.34, 'ARS');
      expect(m.amountMinor).toBe(-16979634);
    });

    it('treats whole numbers correctly', () => {
      expect(Money.fromDecimal(5000, 'ARS').amountMinor).toBe(500000);
      expect(Money.fromDecimal(440, 'USD').amountMinor).toBe(44000);
    });
  });

  describe('construction from minor units', () => {
    it('stores the integer value verbatim', () => {
      const m = Money.fromMinor(855000, 'ARS');
      expect(m.amountMinor).toBe(855000);
      expect(m.currency).toBe('ARS');
    });

    it('rejects non-integer minor units', () => {
      expect(() => Money.fromMinor(100.5, 'ARS')).toThrow();
    });
  });

  describe('toDecimal', () => {
    it('is the inverse of fromDecimal for representable values', () => {
      expect(Money.fromDecimal(12.34, 'ARS').toDecimal()).toBe(12.34);
      expect(Money.fromMinor(44000, 'USD').toDecimal()).toBe(440);
      expect(Money.fromMinor(-16979634, 'ARS').toDecimal()).toBe(-169796.34);
    });
  });

  describe('zero', () => {
    it('creates a zero amount in the given currency', () => {
      const z = Money.zero('EUR');
      expect(z.amountMinor).toBe(0);
      expect(z.currency).toBe('EUR');
      expect(z.isZero()).toBe(true);
    });
  });

  describe('plus', () => {
    it('adds two amounts of the same currency', () => {
      const result = Money.fromDecimal(100.5, 'ARS').plus(Money.fromDecimal(50.25, 'ARS'));
      expect(result.amountMinor).toBe(15075);
      expect(result.currency).toBe('ARS');
    });

    it('throws CurrencyMismatchError when currencies differ', () => {
      const ars = Money.fromDecimal(100, 'ARS');
      const usd = Money.fromDecimal(100, 'USD');
      expect(() => ars.plus(usd)).toThrow(CurrencyMismatchError);
    });

    it('does not mutate the operands', () => {
      const a = Money.fromMinor(1000, 'ARS');
      const b = Money.fromMinor(500, 'ARS');
      a.plus(b);
      expect(a.amountMinor).toBe(1000);
      expect(b.amountMinor).toBe(500);
    });
  });

  describe('minus', () => {
    it('subtracts two amounts of the same currency', () => {
      const result = Money.fromDecimal(100, 'USD').minus(Money.fromDecimal(30.5, 'USD'));
      expect(result.amountMinor).toBe(6950);
    });

    it('can produce a negative result', () => {
      const result = Money.fromMinor(100, 'ARS').minus(Money.fromMinor(300, 'ARS'));
      expect(result.amountMinor).toBe(-200);
      expect(result.isNegative()).toBe(true);
    });

    it('throws CurrencyMismatchError when currencies differ', () => {
      const ars = Money.fromDecimal(100, 'ARS');
      const eur = Money.fromDecimal(100, 'EUR');
      expect(() => ars.minus(eur)).toThrow(CurrencyMismatchError);
    });
  });

  describe('comparison', () => {
    it('reports sign via isZero / isNegative / isPositive', () => {
      expect(Money.fromMinor(0, 'ARS').isZero()).toBe(true);
      expect(Money.fromMinor(-1, 'ARS').isNegative()).toBe(true);
      expect(Money.fromMinor(1, 'ARS').isPositive()).toBe(true);
    });

    it('isGreaterThan / isLessThan compare same-currency amounts', () => {
      const a = Money.fromMinor(1000, 'ARS');
      const b = Money.fromMinor(500, 'ARS');
      expect(a.isGreaterThan(b)).toBe(true);
      expect(b.isLessThan(a)).toBe(true);
    });

    it('comparison across currencies throws CurrencyMismatchError', () => {
      const ars = Money.fromMinor(1000, 'ARS');
      const usd = Money.fromMinor(1000, 'USD');
      expect(() => ars.isGreaterThan(usd)).toThrow(CurrencyMismatchError);
    });

    it('equals requires same amount and same currency', () => {
      expect(Money.fromMinor(1000, 'ARS').equals(Money.fromMinor(1000, 'ARS'))).toBe(true);
      expect(Money.fromMinor(1000, 'ARS').equals(Money.fromMinor(999, 'ARS'))).toBe(false);
      expect(Money.fromMinor(1000, 'ARS').equals(Money.fromMinor(1000, 'USD'))).toBe(false);
    });
  });

  describe('value semantics', () => {
    it('two instances with the same amount and currency are equal by value', () => {
      const a = Money.fromDecimal(12.34, 'ARS');
      const b = Money.fromMinor(1234, 'ARS');
      expect(a.equals(b)).toBe(true);
    });
  });
});
