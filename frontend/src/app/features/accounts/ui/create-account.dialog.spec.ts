import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { CreateAccountDialog } from './create-account.dialog';
import { AccountsStore } from '../application/accounts.store';
import { ApiErrorException } from '../../../shared/domain/map-api-error';

class FakeStore {
  create = vi.fn();
}

function setup() {
  const store = new FakeStore();
  const dialogRef = { close: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      CreateAccountDialog,
      { provide: AccountsStore, useValue: store },
      { provide: MatDialogRef, useValue: dialogRef },
    ],
  });
  const dialog = TestBed.inject(CreateAccountDialog);
  return { dialog, store, dialogRef };
}

describe('CreateAccountDialog', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('does not submit when the form is invalid', async () => {
    const { dialog, store } = setup();
    await dialog.submit(); // empty
    expect(store.create).not.toHaveBeenCalled();
  });

  it('rejects a name that is only spaces (trimmed length)', async () => {
    const { dialog, store } = setup();
    dialog.form.setValue({ name: '   ', currency: 'ARS' });
    await dialog.submit();
    expect(store.create).not.toHaveBeenCalled();
    expect(dialog.form.controls.name.invalid).toBe(true);
  });

  it('requires a currency with no default', async () => {
    const { dialog } = setup();
    expect(dialog.form.controls.currency.value).toBe('');
    dialog.form.controls.name.setValue('Ahorro');
    expect(dialog.form.invalid).toBe(true);
  });

  it('trims the name before creating and closes with the result', async () => {
    const { dialog, store, dialogRef } = setup();
    store.create.mockResolvedValue({ refreshed: true });
    dialog.form.setValue({ name: '  Ahorro  ', currency: 'ARS' });
    await dialog.submit();
    expect(store.create).toHaveBeenCalledWith({ name: 'Ahorro', currency: 'ARS' });
    expect(dialogRef.close).toHaveBeenCalledWith({ refreshed: true });
  });

  it('shows the catalogue message and keeps the dialog open on a create error', async () => {
    const { dialog, store, dialogRef } = setup();
    store.create.mockRejectedValue(new ApiErrorException({ kind: 'validation', fields: [] }));
    dialog.form.setValue({ name: 'Ahorro', currency: 'ARS' });
    await dialog.submit();
    expect(dialog.serverError()).toBe('Revisá los datos ingresados.');
    expect(dialog.serverError()).not.toContain('must be');
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(dialog.submitting()).toBe(false);
  });

  it('shows the network message and re-enables on a network error', async () => {
    const { dialog, store } = setup();
    store.create.mockRejectedValue(new ApiErrorException({ kind: 'network' }));
    dialog.form.setValue({ name: 'Ahorro', currency: 'ARS' });
    await dialog.submit();
    expect(dialog.serverError()).toBe('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
    expect(dialog.submitting()).toBe(false);
  });

  it('does not submit twice while in flight', async () => {
    const { dialog, store } = setup();
    let resolve!: (v: unknown) => void;
    store.create.mockReturnValue(new Promise((r) => (resolve = r)));
    dialog.form.setValue({ name: 'Ahorro', currency: 'ARS' });
    const first = dialog.submit();
    await dialog.submit();
    expect(store.create).toHaveBeenCalledTimes(1);
    resolve({ refreshed: true });
    await first;
  });
});
