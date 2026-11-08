import { Injectable, Injector, inject } from '@angular/core';
import {
  NewTransactionLauncher,
  type NewTransactionRequest,
  type NewTransactionResult,
} from '../../../shared/ui/new-transaction-launcher';

/**
 * Lightweight launcher bound at the composition root. It imports NOTHING from
 * @angular/material nor the dialog, so binding it at the root keeps MatDialog
 * and the dialog component OUT of the initial bundle. The heavy implementation
 * (which does depend on MatDialog) is loaded with a dynamic import() the first
 * time open() is called, and resolved from DI there.
 *
 * Single-flight: while a dialog is opening (import in flight) or open, a second
 * open() returns the SAME promise instead of opening another dialog.
 */
@Injectable()
export class DynamicNewTransactionLauncher extends NewTransactionLauncher {
  private readonly injector = inject(Injector);
  private inFlight: Promise<NewTransactionResult> | null = null;

  override open(request: NewTransactionRequest): Promise<NewTransactionResult> {
    if (this.inFlight) {
      return this.inFlight; // single-flight: reuse the current open
    }
    const p = this.run(request).finally(() => {
      if (this.inFlight === p) {
        this.inFlight = null;
      }
    });
    this.inFlight = p;
    return p;
  }

  private async run(request: NewTransactionRequest): Promise<NewTransactionResult> {
    // The dialog + MatDialog live in this lazily-loaded chunk only.
    const { MatDialogNewTransactionLauncher } = await import('./new-transaction-launcher.impl');
    const impl = this.injector.get(MatDialogNewTransactionLauncher);
    return impl.open(request);
  }
}
