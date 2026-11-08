import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Title } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountDetailStore } from '../application/account-detail.store';
import { AccountSummaryComponent } from './account-summary.component';
import { TransactionRowComponent } from '../../../shared/ui/transaction-row.component';
import { StatePanelComponent } from '../../../shared/ui/state-panel.component';
import { NewTransactionLauncher } from '../../../shared/ui/new-transaction-launcher';
import { type AccountRow } from '../../../shared/application/accounts.store';

@Component({
  selector: 'app-account-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AccountDetailStore], // per-screen instance; resets between navigations
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    AccountSummaryComponent,
    TransactionRowComponent,
    StatePanelComponent,
  ],
  templateUrl: './account-detail.page.html',
  styleUrl: './account-detail.page.scss',
})
export class AccountDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AccountDetailStore);
  private readonly title = inject(Title);
  private readonly launcher = inject(NewTransactionLauncher);

  /** The route :id as a signal; changes when navigating between accounts. */
  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly account = this.store.account;
  readonly transactionsState = this.store.transactionsState;

  /** True while the register dialog is opening (disables the buttons). */
  readonly opening = signal(false);
  /** Set when the dialog chunk failed to load; shown as an accessible notice. */
  readonly launchError = signal(false);

  constructor() {
    // Point the store at the current id whenever it changes (also on first load).
    // setAccountId reads/writes store signals (ensureLoaded, refresh); wrap it in
    // untracked so this effect depends ONLY on the route id, not on those signals
    // — otherwise refresh() would retrigger the effect and loop forever.
    effect(() => {
      const id = this.id();
      if (id) {
        untracked(() => this.store.setAccountId(id));
      }
    });

    // Tab title follows the resolved account name; "Cuenta" until it resolves.
    effect(() => {
      const view = this.account();
      this.title.setTitle(view.kind === 'found' ? view.row.account.name : 'Cuenta');
    });
  }

  transferLink(): unknown[] {
    return ['/transfers'];
  }

  /** Opens the register-income/expense dialog; reloads the detail if created. */
  async registerTransaction(row: AccountRow, type: 'income' | 'expense'): Promise<void> {
    // Material's disabledInteractive does NOT cancel the click on a <button>
    // (only on anchors), so guard against a second open while one is opening.
    if (this.opening()) {
      return;
    }
    this.launchError.set(false);
    this.opening.set(true);
    try {
      const { created } = await this.launcher.open({ row, type });
      if (created) {
        this.store.reload();
      }
    } catch {
      // The dialog chunk failed to load: show an accessible, retryable notice
      // instead of leaving an unhandled rejection.
      this.launchError.set(true);
    } finally {
      this.opening.set(false);
    }
  }

  retryAccount(): void {
    this.store.retryAccount();
  }

  retryTransactions(): void {
    this.store.retryTransactions();
  }
}
