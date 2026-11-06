import { describe, it, expect } from 'vitest';
import { formatMoney } from './format-money';
import { Money } from './money';

describe('formatMoney', () => {
  it('formats a positive ARS amount with the ISO code and es-AR separators', () => {
    // Non-breaking space (U+00A0) between code and number.
    expect(formatMoney(Money.fromDecimal(1234.56, 'ARS'))).toBe('ARS\u00a01.234,56');
  });

  it('formats a negative amount with the sign before the code', () => {
    expect(formatMoney(Money.fromDecimal(-1234.56, 'ARS'))).toBe('-ARS\u00a01.234,56');
  });

  it('always shows two decimals', () => {
    expect(formatMoney(Money.fromDecimal(5000, 'ARS'))).toBe('ARS\u00a05.000,00');
    expect(formatMoney(Money.fromMinor(44000, 'USD'))).toBe('USD\u00a0440,00');
  });

  it('formats USD and EUR with their codes', () => {
    expect(formatMoney(Money.fromDecimal(12.34, 'USD'))).toBe('USD\u00a012,34');
    expect(formatMoney(Money.fromDecimal(12.34, 'EUR'))).toBe('EUR\u00a012,34');
  });

  it('formats zero', () => {
    expect(formatMoney(Money.zero('ARS'))).toBe('ARS\u00a00,00');
  });
});
