import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { DynamicNewTransactionLauncher } from './new-transaction-launcher.dynamic';
import { MatDialogNewTransactionLauncher } from './new-transaction-launcher.impl';
import {
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';
import { type AccountRow } from '../../../shared/application/accounts.store';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';

// We do NOT mock the dynamic import (the Angular test system forbids vi.mock on
// relative paths). The real impl module loads, but we override the impl class in
// DI with a fake open(), so no real MatDialog is ever instantiated. The launcher
// resolves the impl via injector.get(), so this fully controls its behaviour.
const openMock = vi.fn<(r: NewTransactionRequest) => Promise<NewTransactionResult>>();

function request(): NewTransactionRequest {
  const account: Account = { id: 'acc-1', name: 'Cuenta', currency: 'ARS', balance: Money.fromDecimal(1, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
  const row: AccountRow = { account, available: account.balance, hasPending: false };
  return { row, type: 'expense' };
}

/** provideImpl=false leaves the impl unbound, so injector.get throws (stands in
 *  for a failed chunk load: run() rejects the same way). */
function setup(provideImpl = true) {
  TestBed.configureTestingModule({
    providers: [
      DynamicNewTransactionLauncher,
      ...(provideImpl
        ? [{ provide: MatDialogNewTransactionLauncher, useValue: { open: openMock } }]
        : []),
    ],
  });
  return TestBed.inject(DynamicNewTransactionLauncher);
}

describe('DynamicNewTransactionLauncher', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    openMock.mockReset();
  });

  it('delegates to the lazily-loaded impl and returns created:true', async () => {
    openMock.mockResolvedValue({ created: true });
    const launcher = setup();
    expect(await launcher.open(request())).toEqual({ created: true });
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('returns created:false when the dialog closes without creating', async () => {
    openMock.mockResolvedValue({ created: false });
    const launcher = setup();
    expect(await launcher.open(request())).toEqual({ created: false });
  });

  it('is single-flight: a second open while one is in flight returns the same promise', async () => {
    let resolve!: (r: NewTransactionResult) => void;
    openMock.mockReturnValue(new Promise<NewTransactionResult>((r) => (resolve = r)));
    const launcher = setup();

    const first = launcher.open(request());
    const second = launcher.open(request());
    expect(second).toBe(first); // same promise, no second dialog

    resolve({ created: true });
    await first;

    // After it settles, a new open starts a fresh flight.
    openMock.mockResolvedValue({ created: false });
    await launcher.open(request());
    expect(openMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when loading the dialog fails and clears the in-flight guard', async () => {
    // No impl bound -> injector.get throws inside run() (same reject path as a
    // failed dynamic import of the chunk).
    const launcher = setup(false);
    await expect(launcher.open(request())).rejects.toBeTruthy();

    // Guard released: binding the impl and opening again works.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        DynamicNewTransactionLauncher,
        { provide: MatDialogNewTransactionLauncher, useValue: { open: openMock } },
      ],
    });
    const recovered = TestBed.inject(DynamicNewTransactionLauncher);
    openMock.mockResolvedValue({ created: true });
    expect(await recovered.open(request())).toEqual({ created: true });
  });
});
