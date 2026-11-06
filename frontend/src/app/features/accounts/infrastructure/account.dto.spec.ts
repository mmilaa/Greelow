import { describe, it, expect } from 'vitest';
import { mapAccount, type AccountDto } from './account.dto';
import { Money } from '../../../shared/domain/money';
import { InvalidDataError } from '../../../shared/domain/errors';

// Fixture copied from docs/api-samples/02-accounts.json (not imported).
function accountDto(overrides: Partial<AccountDto> = {}): AccountDto {
  return {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Cuenta Pesos',
    currency: 'ARS',
    createdAt: '2026-08-01T09:00:00Z',
    balance: 855000,
    ...overrides,
  };
}

describe('mapAccount', () => {
  it('maps a valid account, converting balance to Money', () => {
    const account = mapAccount(accountDto());
    expect(account.id).toBe('acc-1');
    expect(account.name).toBe('Cuenta Pesos');
    expect(account.currency).toBe('ARS');
    expect(account.balance.equals(Money.fromDecimal(855000, 'ARS'))).toBe(true);
    expect(account.createdAt).toBe('2026-08-01T09:00:00Z');
  });

  it('maps a negative balance (case F)', () => {
    const account = mapAccount(accountDto({ balance: -169796.34 }));
    expect(account.balance.equals(Money.fromDecimal(-169796.34, 'ARS'))).toBe(true);
  });

  it('throws InvalidDataError on an unsupported currency (case B)', () => {
    expect(() => mapAccount(accountDto({ currency: 'BRL' }))).toThrow(InvalidDataError);
    expect(() => mapAccount(accountDto({ currency: 'ars' }))).toThrow(InvalidDataError);
  });

  it('throws InvalidDataError when balance is not a number (case C)', () => {
    expect(() => mapAccount(accountDto({ balance: '855000' }))).toThrow(InvalidDataError);
    expect(() => mapAccount(accountDto({ balance: null }))).toThrow(InvalidDataError);
  });

  it('throws InvalidDataError when id is missing', () => {
    expect(() => mapAccount(accountDto({ id: undefined }))).toThrow(InvalidDataError);
  });
});
