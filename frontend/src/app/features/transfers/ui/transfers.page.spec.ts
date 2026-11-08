import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TransfersPage } from './transfers.page';
import { TransferFormComponent } from './transfer-form.component';
import { AccountPort } from '../../../shared/application/account.port';
import { PendingTransfersPort } from '../../../shared/application/pending-transfers.port';
import { TransactionPort } from '../../../shared/application/transaction.port';
import { TransferPort } from '../application/transfer.port';
import { TransferStore } from '../application/transfer.store';
import { type Account } from '../../../shared/domain/account';
import { Money } from '../../../shared/domain/money';

function account(id: string): Account {
  return { id, name: id, currency: 'ARS', balance: Money.fromDecimal(1000, 'ARS'), createdAt: '2026-08-01T09:00:00Z' };
}

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'transfers', component: TransfersPage },
        { path: 'accounts/:id', children: [] },
      ]),
      { provide: AccountPort, useValue: { list: async () => [account('acc-1'), account('acc-2')], create: async () => ({}) } },
      { provide: PendingTransfersPort, useValue: { pendingOutgoing: async () => [] } },
      { provide: TransactionPort, useValue: { list: async () => ({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }), create: async () => ({}) } },
      { provide: TransferPort, useValue: { create: async () => ({ id: 't-1', status: 'pending', from: null, to: {} }), getById: async () => ({ id: 't-1', status: 'pending', from: null, to: {} }) } },
    ],
  });
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

async function mountAt(url: string) {
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, TransfersPage);
  await settle();
  harness.detectChanges();
  const form = harness.routeDebugElement!.query(
    (de) => de.componentInstance instanceof TransferFormComponent,
  ).componentInstance as TransferFormComponent;
  return { harness, page, form };
}

function mount() {
  return mountAt('/transfers?from=acc-1');
}

describe('TransfersPage (clear-on-edit and terminal focus)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    setup();
  });

  it('editing a field while blocked clears the block (store.reset)', async () => {
    const { harness, page, form } = await mount();
    // TransferStore is provided at the component level; reach it via the page injector.
    const store = harness.routeDebugElement!.injector.get(TransferStore);
    // Force a blocked state directly on the real store, then edit the form.
    store['stateSig'].set({ status: 'blocked', reason: 'cross-currency', available: null });
    expect(page.state().status).toBe('blocked');

    form.form.controls.amount.setValue('123');
    page.onFormEdited();
    expect(page.state().status).toBe('idle');
  });

  it('editing a field clears a visible known create error (lastError)', async () => {
    const { harness, page } = await mount();
    const store = harness.routeDebugElement!.injector.get(TransferStore);
    store['stateSig'].set({ status: 'idle', lastError: { kind: 'insufficient-funds' } });
    expect(page.lastError()).toEqual({ kind: 'insufficient-funds' });

    page.onFormEdited();
    expect(page.lastError()).toBeNull();
  });

  it('"Hacer otra transferencia" keeps origin/destination, clears amount/description, focuses amount', async () => {
    const { form, page } = await mount();
    form.form.controls.destination.setValue('acc-2');
    form.form.controls.amount.setValue('500');
    form.form.controls.description.setValue('x');
    const focusSpy = vi.spyOn(form as unknown as { focusAmount: () => void }, 'focusAmount');

    page.onAgain();

    expect(form.form.controls.origin.value).toBe('acc-1');
    expect(form.form.controls.destination.value).toBe('acc-2');
    expect(form.form.controls.amount.value).toBe('');
    expect(form.form.controls.description.value).toBe('');
    expect(focusSpy).toHaveBeenCalled();
  });

  it('the destination is disabled while there is no origin', async () => {
    // Mount without ?from so no origin is preselected.
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transfers', TransfersPage);
    await settle();
    harness.detectChanges();
    const form = harness.routeDebugElement!.query(
      (de) => de.componentInstance instanceof TransferFormComponent,
    ).componentInstance as TransferFormComponent;
    expect(form.hasOrigin()).toBe(false);
    expect(form.ineligibleHint()).toBe('Elegí primero la cuenta de origen');
  });

  it('ignores ?from=acc-9999 (no origin preselected)', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/transfers?from=acc-9999', TransfersPage);
    await settle();
    harness.detectChanges();
    const form = harness.routeDebugElement!.query(
      (de) => de.componentInstance instanceof TransferFormComponent,
    ).componentInstance as TransferFormComponent;
    expect(form.originAccount()).toBeNull();
  });
});
