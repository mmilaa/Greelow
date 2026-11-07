import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MoneyAmountComponent } from '../../../shared/ui/money-amount.component';
import { type AccountRow } from '../application/accounts.store';

/**
 * Presentational summary of an account's money: currency code, ledger balance,
 * and (only when there are outgoing pending transfers) the available balance
 * with an "in process" notice. It does NOT render the name or the id; each
 * container (list card / detail page) places those and the heading.
 */
@Component({
  selector: 'app-account-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MoneyAmountComponent],
  templateUrl: './account-summary.component.html',
  styleUrl: './account-summary.component.scss',
})
export class AccountSummaryComponent {
  readonly row = input.required<AccountRow>();
}
