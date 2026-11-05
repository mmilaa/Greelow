import { describe, it, expect } from 'vitest';
import { DomainError, CurrencyMismatchError, InvalidAmountError } from './errors';

describe('domain errors', () => {
  describe('CurrencyMismatchError', () => {
    it('is a DomainError and an Error', () => {
      const err = new CurrencyMismatchError('ARS', 'USD');
      expect(err).toBeInstanceOf(CurrencyMismatchError);
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });

    it('carries both currencies and a readable name', () => {
      const err = new CurrencyMismatchError('ARS', 'USD');
      expect(err.left).toBe('ARS');
      expect(err.right).toBe('USD');
      expect(err.name).toBe('CurrencyMismatchError');
    });
  });

  describe('InvalidAmountError', () => {
    it('is a DomainError and an Error', () => {
      const err = new InvalidAmountError('bad amount');
      expect(err).toBeInstanceOf(InvalidAmountError);
      expect(err).toBeInstanceOf(DomainError);
      expect(err).toBeInstanceOf(Error);
    });

    it('exposes the message and a readable name', () => {
      const err = new InvalidAmountError('bad amount');
      expect(err.message).toBe('bad amount');
      expect(err.name).toBe('InvalidAmountError');
    });
  });
});
