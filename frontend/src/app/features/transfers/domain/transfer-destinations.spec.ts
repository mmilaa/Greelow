import { describe, it, expect } from 'vitest';
import { eligibleDestinations, hasEligibleDestination } from './transfer-destinations';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';
import { type Currency } from '../../../shared/domain/currency';

function account(id: string, currency: Currency = 'ARS'): Account {
  return {
    id,
    name: `Cuenta ${id}`,
    currency,
    balance: Money.fromDecimal(1000, currency),
    createdAt: '2026-08-01T09:00:00Z',
  };
}

describe('eligibleDestinations', () => {
  it('marks everything ineligible with no reason when there is no origin', () => {
    const accounts = [account('acc-1'), account('acc-2')];
    const result = eligibleDestinations(null, accounts);
    expect(result.every((o) => !o.eligible && o.reason === null)).toBe(true);
  });

  it('marks the source account itself as same-account', () => {
    const accounts = [account('acc-1'), account('acc-2')];
    const result = eligibleDestinations('acc-1', accounts);
    const self = result.find((o) => o.account.id === 'acc-1')!;
    expect(self.eligible).toBe(false);
    expect(self.reason).toBe('same-account');
  });

  it('marks a different-currency account as cross-currency', () => {
    const accounts = [account('acc-1', 'ARS'), account('acc-2', 'USD')];
    const result = eligibleDestinations('acc-1', accounts);
    const usd = result.find((o) => o.account.id === 'acc-2')!;
    expect(usd.eligible).toBe(false);
    expect(usd.reason).toBe('cross-currency');
  });

  it('marks a same-currency, different account as eligible', () => {
    const accounts = [account('acc-1', 'ARS'), account('acc-2', 'ARS')];
    const result = eligibleDestinations('acc-1', accounts);
    const other = result.find((o) => o.account.id === 'acc-2')!;
    expect(other.eligible).toBe(true);
    expect(other.reason).toBeNull();
  });

  it('when the only other account is a different currency, none is eligible', () => {
    const accounts = [account('acc-1', 'ARS'), account('acc-2', 'USD')];
    const result = eligibleDestinations('acc-1', accounts);
    expect(result.some((o) => o.eligible)).toBe(false);
    // acc-1 is same-account, acc-2 is cross-currency.
    expect(result.map((o) => o.reason)).toEqual(['same-account', 'cross-currency']);
  });

  it('ignores an origin id that is not in the list (treats it as no source)', () => {
    const accounts = [account('acc-1'), account('acc-2')];
    const result = eligibleDestinations('acc-9999', accounts);
    expect(result.every((o) => !o.eligible && o.reason === null)).toBe(true);
  });
});

describe('hasEligibleDestination', () => {
  it('is true when a same-currency peer exists', () => {
    const accounts = [account('acc-1', 'ARS'), account('acc-2', 'ARS')];
    expect(hasEligibleDestination('acc-1', accounts)).toBe(true);
  });

  it('is false with a single account', () => {
    expect(hasEligibleDestination('acc-1', [account('acc-1')])).toBe(false);
  });

  it('is false when every peer is a different currency', () => {
    const accounts = [account('acc-1', 'ARS'), account('acc-2', 'USD')];
    expect(hasEligibleDestination('acc-1', accounts)).toBe(false);
  });

  it('is false with no origin', () => {
    const accounts = [account('acc-1'), account('acc-2')];
    expect(hasEligibleDestination(null, accounts)).toBe(false);
  });
});
