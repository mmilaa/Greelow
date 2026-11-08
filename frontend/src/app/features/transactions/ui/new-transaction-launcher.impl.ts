import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  NewTransactionLauncher,
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';
import { NewTransactionDialog } from './new-transaction.dialog';

/**
 * The heavy launcher: it depends on MatDialog and the dialog component, so it
 * must NOT be imported statically from the composition root (that would pull
 * MatDialog and the dialog into the initial bundle). It is loaded lazily by
 * DynamicNewTransactionLauncher via import() and resolved from DI there.
 *
 * providedIn 'root' so the lazy chunk can inject it without extra wiring.
 */
@Injectable({ providedIn: 'root' })
export class MatDialogNewTransactionLauncher {
  private readonly dialog = inject(MatDialog);

  open(request: NewTransactionRequest): Promise<NewTransactionResult> {
    const ref = this.dialog.open(NewTransactionDialog, { data: request, restoreFocus: true });
    return ref
      .afterClosed()
      .toPromise()
      .then((result) => result ?? { created: false });
  }
}
