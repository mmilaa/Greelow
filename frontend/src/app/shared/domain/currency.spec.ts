import { describe, it, expect } from 'vitest';
import {
  type Currency,
  CURRENCIES,
  currencyDecimals,
  minorUnitFactor,
  isCurrency,
} from './currency';

describe('Currency', () => {
  describe('CURRENCIES', () => {
    it('contains exactly the three supported currencies', () => {
      expect([...CURRENCIES].sort()).toEqual(['ARS', 'EUR', 'USD']);
    });
  });

  describe('currencyDecimals', () => {
    it('returns 2 decimals for each supported currency', () => {
      expect(currencyDecimals('ARS')).toBe(2);
      expect(currencyDecimals('USD')).toBe(2);
      expect(currencyDecimals('EUR')).toBe(2);
    });
  });

  describe('minorUnitFactor', () => {
    it('is 10^decimals for each currency', () => {
      expect(minorUnitFactor('ARS')).toBe(100);
      expect(minorUnitFactor('USD')).toBe(100);
      expect(minorUnitFactor('EUR')).toBe(100);
    });
  });

  describe('isCurrency', () => {
    it('accepts supported currency codes', () => {
      expect(isCurrency('ARS')).toBe(true);
      expect(isCurrency('USD')).toBe(true);
      expect(isCurrency('EUR')).toBe(true);
    });

    it('rejects unknown or malformed codes', () => {
      expect(isCurrency('BRL')).toBe(false);
      expect(isCurrency('ars')).toBe(false);
      expect(isCurrency('')).toBe(false);
      expect(isCurrency(null)).toBe(false);
      expect(isCurrency(undefined)).toBe(false);
      expect(isCurrency(42)).toBe(false);
    });

    it('narrows the type to Currency', () => {
      const raw: unknown = 'USD';
      if (isCurrency(raw)) {
        // Type-level assertion: raw is Currency inside this block.
        const c: Currency = raw;
        expect(c).toBe('USD');
      } else {
        throw new Error('expected USD to be a valid currency');
      }
    });
  });
});
