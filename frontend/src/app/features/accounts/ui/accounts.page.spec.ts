import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountsPage } from './accounts.page';
import { AccountsStore, type AccountsState } from '../../../shared/application/accounts.store';

function setup(refreshing: boolean) {
  const refreshingSig = signal(refreshing);
  const stateSig = signal<AccountsState>({ status: 'loading' });
  const store = {
    state: stateSig.asReadonly(),
    refreshing: refreshingSig.asReadonly(),
    load: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: AccountsStore, useValue: store },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(AccountsPage);
  return { fixture, component: fixture.componentInstance, store, refreshingSig };
}

describe('AccountsPage refresh guard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('refreshes when not already refreshing', () => {
    const { component, store } = setup(false);
    component.refresh();
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing when a refresh is already in flight (disabledInteractive click)', () => {
    const { component, store } = setup(true);
    component.refresh();
    expect(store.refresh).not.toHaveBeenCalled();
  });
});
