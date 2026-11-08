import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountsStore } from '../../../shared/application/accounts.store';
import { AccountCardComponent } from './account-card.component';
import { CreateAccountDialog, type CreateAccountResult } from './create-account.dialog';
import { PageHeaderComponent } from '../../../shared/ui/page-header.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel.component';

@Component({
  selector: 'app-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    AccountCardComponent,
    PageHeaderComponent,
    StatePanelComponent,
  ],
  templateUrl: './accounts.page.html',
  styleUrl: './accounts.page.scss',
})
export class AccountsPage implements OnInit {
  private readonly store = inject(AccountsStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly state = this.store.state;
  readonly refreshing = this.store.refreshing;
  readonly ready = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s : null;
  });

  ngOnInit(): void {
    void this.store.load();
  }

  refresh(): void {
    // disabledInteractive does not cancel the click on a <button>, so guard
    // against a second refresh while one is already in flight.
    if (this.refreshing()) {
      return;
    }
    void this.store.refresh();
  }

  retry(): void {
    void this.store.load();
  }

  openCreate(): void {
    const ref = this.dialog.open<CreateAccountDialog, unknown, CreateAccountResult>(
      CreateAccountDialog,
    );
    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return; // cancelled
      }
      const message = result.refreshed
        ? 'Cuenta creada.'
        : 'Cuenta creada, pero no pudimos actualizar la lista.';
      this.snackBar.open(message, 'Cerrar', { duration: 5000 });
    });
  }
}
