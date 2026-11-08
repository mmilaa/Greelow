import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogNewTransactionLauncher } from './new-transaction-launcher.impl';
import { type NewTransactionRequest, type NewTransactionResult } from '../../../shared/ui/new-transaction-launcher';
import { type AccountRow } from '../../../shared/application/accounts.store';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';

function request(): NewTransactionRequest {
  const account: Account = { id: 'acc-1', name: 'Cuenta', currency: 'ARS', balance: Money.fromDecimal(1, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
  const row: AccountRow = { account, available: account.balance, hasPending: false };
  return { row, type: 'expense' };
}

/** Fake MatDialog whose open() returns a ref with a canned afterClosed(). */
function fakeDialog(closedValue: NewTransactionResult | undefined) {
  const open = vi.fn().mockReturnValue({ afterClosed: () => of(closedValue) });
  return { open };
}

function setup(closedValue: NewTransactionResult | undefined) {
  const dialog = fakeDialog(closedValue);
  TestBed.configureTestingModule({
    providers: [
      MatDialogNewTransactionLauncher,
      { provide: MatDialog, useValue: dialog },
    ],
  });
  return { launcher: TestBed.inject(MatDialogNewTransactionLauncher), dialog };
}

describe('MatDialogNewTransactionLauncher (real impl, fake MatDialog)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('opens the dialog with the request data and restoreFocus', async () => {
    const { launcher, dialog } = setup({ created: true });
    await launcher.open(request());
    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [, config] = dialog.open.mock.calls[0];
    expect(config).toMatchObject({ data: request(), restoreFocus: true });
  });

  it('maps a created result to { created: true }', async () => {
    const { launcher } = setup({ created: true });
    expect(await launcher.open(request())).toEqual({ created: true });
  });

  it('maps a dismiss (Escape / backdrop click -> undefined) to { created: false }', async () => {
    const { launcher } = setup(undefined);
    expect(await launcher.open(request())).toEqual({ created: false });
  });

  it('maps an explicit cancel ({ created: false }) to { created: false }', async () => {
    const { launcher } = setup({ created: false });
    expect(await launcher.open(request())).toEqual({ created: false });
  });
});
