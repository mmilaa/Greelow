import { describe, it, expect } from 'vitest';
import { Money } from '../../../shared/domain/money';
import { CurrencyMismatchError } from '../../../shared/domain/errors';
import { type AccountTransaction } from '../../../shared/domain/available-balance';
import { canTransfer, type TransferRequest } from './transfer-policy';

// --- helpers -------------------------------------------------------------

function ars(amount: number): Money {
  return Money.fromDecimal(amount, 'ARS');
}

function usd(amount: number): Money {
  return Money.fromDecimal(amount, 'USD');
}

/** Builds a transaction, defaulting to an outgoing pending transfer (the kind that reserves funds). */
function transaction(overrides: Partial<AccountTransaction> = {}): AccountTransaction {
  return {
    accountId: 'acc-1',
    direction: 'out',
    status: 'pending',
    amount: ars(1000),
    ...overrides,
  };
}

/** Builds a transfer request to an own account with ARS currency by default. */
function request(overrides: Partial<TransferRequest> = {}): TransferRequest {
  return {
    source: { accountId: 'acc-1', currency: 'ARS', balance: ars(100000) },
    destination: { kind: 'own', accountId: 'acc-2', currency: 'ARS' },
    amount: ars(5000),
    transactions: [],
    ...overrides,
  };
}

// --- canTransfer: allowed path -------------------------------------------

describe('canTransfer - allowed', () => {
  it('allows a valid same-currency transfer to an own account', () => {
    const result = canTransfer(request({ amount: ars(5000) }));
    expect(result).toEqual({ allowed: true });
  });

  it('allows an amount exactly equal to the available balance', () => {
    const result = canTransfer(
      request({ source: { accountId: 'acc-1', currency: 'ARS', balance: ars(5000) }, amount: ars(5000) }),
    );
    expect(result).toEqual({ allowed: true });
  });

  it('allows an amount equal to the available balance after a pending reservation', () => {
    // Ledger 10000, pending out 5000 => available 5000; an amount of 5000 is allowed.
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(10000) },
        amount: ars(5000),
        transactions: [transaction({ amount: ars(5000) })],
      }),
    );
    expect(result).toEqual({ allowed: true });
  });
});

// --- canTransfer: block reasons & ordering -------------------------------

describe('canTransfer - blocked', () => {
  it('blocks a transfer to the same account', () => {
    const result = canTransfer(
      request({ destination: { kind: 'own', accountId: 'acc-1', currency: 'ARS' } }),
    );
    expect(result).toEqual({ allowed: false, reason: 'same-account' });
  });

  it('blocks a non-positive amount (zero)', () => {
    const result = canTransfer(request({ amount: ars(0) }));
    expect(result).toEqual({ allowed: false, reason: 'non-positive-amount' });
  });

  it('blocks a negative amount', () => {
    const result = canTransfer(request({ amount: ars(-100) }));
    expect(result).toEqual({ allowed: false, reason: 'non-positive-amount' });
  });

  it('blocks a transfer to an external account (unknown destination currency)', () => {
    const result = canTransfer(
      request({ destination: { kind: 'external', accountId: 'acc-ext' } }),
    );
    expect(result).toEqual({ allowed: false, reason: 'unknown-destination-currency' });
  });

  it('blocks a cross-currency transfer between own accounts', () => {
    const result = canTransfer(
      request({ destination: { kind: 'own', accountId: 'acc-2', currency: 'USD' } }),
    );
    expect(result).toEqual({ allowed: false, reason: 'cross-currency' });
  });

  it('blocks when the amount exceeds the available balance by one cent', () => {
    const result = canTransfer(
      request({ source: { accountId: 'acc-1', currency: 'ARS', balance: ars(5000) }, amount: ars(5000.01) }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });

  it('blocks one cent over the available balance after a pending reservation', () => {
    // Ledger 10000, pending out 5000 => available 5000; 5000.01 is one cent too much.
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(10000) },
        amount: ars(5000.01),
        transactions: [transaction({ amount: ars(5000) })],
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });

  it('blocks a real overdraft from the race-condition scenario', () => {
    // 06-race-condition.txt: ledger 848987.66, one 509392 already pending out,
    // available = 339595.66, a new 509392 transfer must be blocked.
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(848987.66) },
        amount: ars(509392),
        transactions: [transaction({ amount: ars(509392) })],
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });

  it('blocks everything when the available balance is already negative', () => {
    const result = canTransfer(
      request({ source: { accountId: 'acc-1', currency: 'ARS', balance: ars(-1000) }, amount: ars(100) }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });

  it('blocks the smallest amount when available balance is exactly zero', () => {
    // Ledger equals the sum of outgoing pending transfers => available 0;
    // even 0.01 must be blocked.
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(5000) },
        amount: ars(0.01),
        transactions: [transaction({ amount: ars(5000) })],
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });

  it('blocks when a pending reservation exceeds a positive ledger balance', () => {
    // Positive ledger, but pending out is larger than the balance: available is negative.
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(100000) },
        amount: ars(100),
        transactions: [transaction({ amount: ars(150000) })],
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'insufficient-funds' });
  });
});

// --- canTransfer: ordering when several checks fail ----------------------

describe('canTransfer - ordering of block reasons', () => {
  it('same-account wins over a non-positive amount', () => {
    const result = canTransfer(
      request({ destination: { kind: 'own', accountId: 'acc-1', currency: 'ARS' }, amount: ars(0) }),
    );
    expect(result).toEqual({ allowed: false, reason: 'same-account' });
  });

  it('non-positive-amount wins over unknown-destination-currency', () => {
    const result = canTransfer(
      request({ destination: { kind: 'external', accountId: 'acc-ext' }, amount: ars(0) }),
    );
    expect(result).toEqual({ allowed: false, reason: 'non-positive-amount' });
  });

  it('unknown-destination-currency wins over insufficient funds', () => {
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(10) },
        destination: { kind: 'external', accountId: 'acc-ext' },
        amount: ars(5000),
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'unknown-destination-currency' });
  });

  it('cross-currency wins over insufficient funds', () => {
    const result = canTransfer(
      request({
        source: { accountId: 'acc-1', currency: 'ARS', balance: ars(10) },
        destination: { kind: 'own', accountId: 'acc-2', currency: 'USD' },
        amount: ars(5000),
      }),
    );
    expect(result).toEqual({ allowed: false, reason: 'cross-currency' });
  });
});

// --- caller contract: amount must be in the source currency --------------

describe('canTransfer - amount currency contract (validated first, deterministic)', () => {
  it('throws CurrencyMismatchError when the amount is not in the source currency', () => {
    // The amount must always be in the source account currency. A mismatch is a
    // caller bug, surfaced deterministically before any other check.
    expect(() =>
      canTransfer(
        request({
          source: { accountId: 'acc-1', currency: 'ARS', balance: ars(100000) },
          destination: { kind: 'own', accountId: 'acc-2', currency: 'ARS' },
          amount: usd(5000),
        }),
      ),
    ).toThrow(CurrencyMismatchError);
  });

  it('throws CurrencyMismatchError even for an external destination', () => {
    // The currency check runs first, regardless of the rest of the request.
    expect(() =>
      canTransfer(
        request({
          source: { accountId: 'acc-1', currency: 'ARS', balance: ars(100000) },
          destination: { kind: 'external', accountId: 'acc-ext' },
          amount: usd(5000),
        }),
      ),
    ).toThrow(CurrencyMismatchError);
  });
});
